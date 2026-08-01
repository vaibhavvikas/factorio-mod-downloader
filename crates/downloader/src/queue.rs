use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::{Mutex, Semaphore};

use factorio::models::ResolvedDownloadItem;
use crate::downloader::download_mod_file;
use crate::models::{DownloadStatus, DownloadTask};

pub const DEFAULT_MAX_CONCURRENT_DOWNLOADS: usize = 5;

#[derive(Clone)]
pub struct DownloadQueueManager {
    tasks: Arc<Mutex<HashMap<String, DownloadTask>>>,
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    semaphore: Arc<Semaphore>,
    client: reqwest::Client,
}

impl Default for DownloadQueueManager {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_CONCURRENT_DOWNLOADS)
    }
}

fn scan_downloaded_files(output_dir: &std::path::Path) -> HashMap<String, (String, PathBuf)> {
    let mut installed = HashMap::new();

    // Purge orphaned .tmp folder from previous ungraceful exit/crash
    let tmp_dir = output_dir.join(".tmp");
    if tmp_dir.exists() && tmp_dir.is_dir() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
    }

    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let ext = path.extension().and_then(|e| e.to_str());
                if ext == Some("tmp") {
                    let _ = std::fs::remove_file(&path);
                } else if ext == Some("zip") {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        if let Some((name, ver)) = stem.rsplit_once('_') {
                            installed.insert(name.to_string(), (ver.to_string(), path.clone()));
                        }
                    }
                }
            }
        }
    }
    installed
}

impl DownloadQueueManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            client: reqwest::Client::new(),
        }
    }

    pub async fn enqueue_batch(&self, items: Vec<ResolvedDownloadItem>, output_dir: PathBuf) {
        let existing_mods = scan_downloaded_files(&output_dir);

        for item in items {
            let task_id = format!("{}_{}", item.id, item.version);
            let mut is_update_replacement = false;
            let mut old_installed_path: Option<PathBuf> = None;

            // Check if matching mod version is already installed in target folder
            if let Some((installed_ver, installed_path)) = existing_mods.get(&item.id) {
                if installed_ver == &item.version {
                    let actual_size_bytes = std::fs::metadata(installed_path)
                        .map(|m| m.len())
                        .unwrap_or(0);

                    let mut guard = self.tasks.lock().await;
                    guard.insert(
                        task_id.clone(),
                        DownloadTask {
                            id: item.id.clone(),
                            title: item.title.clone(),
                            version: item.version.clone(),
                            file_name: item.file_name.clone(),
                            sha1: item.sha1.clone(),
                            downloaded_bytes: actual_size_bytes,
                            total_bytes: actual_size_bytes,
                            status: DownloadStatus::AlreadyExists,
                        },
                    );
                    continue;
                } else {
                    is_update_replacement = true;
                    old_installed_path = Some(installed_path.clone());
                }
            }

            let cancel_flag = Arc::new(AtomicBool::new(false));

            {
                let mut guard = self.tasks.lock().await;
                if let Some(existing) = guard.get(&task_id) {
                    if existing.status == DownloadStatus::Completed
                        || existing.status == DownloadStatus::AlreadyExists
                        || existing.status == DownloadStatus::Updated
                        || existing.status == DownloadStatus::Downloading
                    {
                        continue;
                    }
                }

                guard.insert(
                    task_id.clone(),
                    DownloadTask {
                        id: item.id.clone(),
                        title: item.title.clone(),
                        version: item.version.clone(),
                        file_name: item.file_name.clone(),
                        sha1: item.sha1.clone(),
                        downloaded_bytes: 0,
                        total_bytes: 0,
                        status: DownloadStatus::Pending,
                    },
                );

                let mut flags = self.cancel_flags.lock().await;
                flags.insert(task_id.clone(), cancel_flag.clone());
            }

            let manager = self.clone();
            let output_dir_clone = output_dir.clone();
            let cancel_flag_clone = cancel_flag.clone();

            tokio::spawn(async move {
                if cancel_flag_clone.load(Ordering::Relaxed) {
                    let mut guard = manager.tasks.lock().await;
                    if let Some(task) = guard.get_mut(&task_id) {
                        task.status = DownloadStatus::Failed("Cancelled by user".to_string());
                    }
                    return;
                }

                let _permit = manager.semaphore.acquire().await.unwrap();

                if cancel_flag_clone.load(Ordering::Relaxed) {
                    let mut guard = manager.tasks.lock().await;
                    if let Some(task) = guard.get_mut(&task_id) {
                        task.status = DownloadStatus::Failed("Cancelled by user".to_string());
                    }
                    return;
                }

                {
                    let mut guard = manager.tasks.lock().await;
                    if let Some(task) = guard.get_mut(&task_id) {
                        task.status = DownloadStatus::Downloading;
                    }
                }

                let mut attempts = 0;
                let max_retries = 3;
                let mut last_error = String::new();
                let mut download_success = false;

                while attempts < max_retries {
                    if cancel_flag_clone.load(Ordering::Relaxed) {
                        last_error = "Cancelled by user".to_string();
                        break;
                    }

                    attempts += 1;

                    let task_id_clone = task_id.clone();
                    let manager_progress = manager.clone();

                    let result = download_mod_file(
                        &manager.client,
                        &item.id,
                        &item.version,
                        &item.file_name,
                        &item.sha1,
                        &output_dir_clone,
                        cancel_flag_clone.clone(),
                        move |downloaded, total| {
                            let manager_inner = manager_progress.clone();
                            let tid = task_id_clone.clone();
                            tokio::spawn(async move {
                                let mut guard = manager_inner.tasks.lock().await;
                                if let Some(task) = guard.get_mut(&tid) {
                                    task.downloaded_bytes = downloaded;
                                    task.total_bytes = total;
                                }
                            });
                        },
                    )
                    .await;

                    match result {
                        Ok(_) => {
                            download_success = true;
                            break;
                        }
                        Err(err) => {
                            let is_cancelled = err.contains("Cancelled by user") || cancel_flag_clone.load(Ordering::Relaxed);
                            let is_404 = err.contains("404");
                            last_error = err;

                            {
                                let mut guard = manager.tasks.lock().await;
                                if let Some(task) = guard.get_mut(&task_id) {
                                    task.downloaded_bytes = 0;
                                }
                            }

                            if is_cancelled || is_404 {
                                break;
                            }
                            if attempts < max_retries {
                                tokio::time::sleep(std::time::Duration::from_millis(500 * attempts as u64)).await;
                            }
                        }
                    }
                }

                let mut guard = manager.tasks.lock().await;
                if let Some(task) = guard.get_mut(&task_id) {
                    if download_success {
                        if let Some(ref old_path) = old_installed_path {
                            let _ = std::fs::remove_file(old_path);
                        }
                        task.status = if is_update_replacement {
                            DownloadStatus::Updated
                        } else {
                            DownloadStatus::Completed
                        };
                    } else {
                        task.status = DownloadStatus::Failed(last_error);
                    }
                }
            });
        }
    }

    pub async fn clear_completed(&self) {
        let mut guard = self.tasks.lock().await;
        guard.retain(|_, task| matches!(task.status, DownloadStatus::Pending | DownloadStatus::Downloading | DownloadStatus::Failed(_)));
    }

    pub async fn retry_task(&self, task_id: &str, output_dir: PathBuf) {
        let mut guard = self.tasks.lock().await;
        if let Some(task) = guard.get_mut(task_id) {
            let item = ResolvedDownloadItem {
                id: task.id.clone(),
                title: task.title.clone(),
                version: task.version.clone(),
                file_name: task.file_name.clone(),
                sha1: task.sha1.clone(),
            };
            guard.remove(task_id);
            drop(guard);

            self.enqueue_batch(vec![item], output_dir).await;
        }
    }

    pub async fn cancel_task(&self, task_id: &str) {
        {
            let flags = self.cancel_flags.lock().await;
            if let Some(flag) = flags.get(task_id) {
                flag.store(true, Ordering::Relaxed);
            }
        }
        let mut guard = self.tasks.lock().await;
        if let Some(task) = guard.get_mut(task_id) {
            task.status = DownloadStatus::Failed("Cancelled by user".to_string());
        }
    }

    pub async fn cancel_all(&self) {
        {
            let flags = self.cancel_flags.lock().await;
            for flag in flags.values() {
                flag.store(true, Ordering::Relaxed);
            }
        }
        let mut guard = self.tasks.lock().await;
        for task in guard.values_mut() {
            if matches!(task.status, DownloadStatus::Pending | DownloadStatus::Downloading) {
                task.status = DownloadStatus::Failed("Cancelled by user".to_string());
            }
        }
    }

    pub async fn get_all_tasks(&self) -> Vec<DownloadTask> {
        let guard = self.tasks.lock().await;
        guard.values().cloned().collect()
    }
}
