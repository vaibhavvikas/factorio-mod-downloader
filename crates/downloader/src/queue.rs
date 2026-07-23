use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};

use factorio::models::ResolvedDownloadItem;
use crate::downloader::download_mod_file;
use crate::models::{DownloadStatus, DownloadTask};

pub const DEFAULT_MAX_CONCURRENT_DOWNLOADS: usize = 5;

#[derive(Clone)]
pub struct DownloadQueueManager {
    tasks: Arc<Mutex<HashMap<String, DownloadTask>>>,
    semaphore: Arc<Semaphore>,
    client: reqwest::Client,
}

impl Default for DownloadQueueManager {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_CONCURRENT_DOWNLOADS)
    }
}

fn scan_installed_mods(output_dir: &std::path::Path) -> HashMap<String, (String, PathBuf)> {
    let mut installed = HashMap::new();
    if let Ok(entries) = std::fs::read_dir(output_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("zip") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some((name, ver)) = stem.rsplit_once('_') {
                        installed.insert(name.to_string(), (ver.to_string(), path.clone()));
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
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            client: reqwest::Client::new(),
        }
    }

    pub async fn enqueue_batch(&self, items: Vec<ResolvedDownloadItem>, output_dir: PathBuf) {
        let existing_mods = scan_installed_mods(&output_dir);

        for item in items {
            let task_id = format!("{}_{}", item.id, item.version);
            let mut is_update_replacement = false;

            // Check if matching mod version is already installed in target folder
            if let Some((installed_ver, installed_path)) = existing_mods.get(&item.id) {
                if installed_ver == &item.version {
                    // Exact version already downloaded: read actual file size in bytes
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
                    // Outdated or mismatched version: remove old zip to prevent duplicate version conflicts
                    let _ = std::fs::remove_file(installed_path);
                    is_update_replacement = true;
                }
            }

            {
                let mut guard = self.tasks.lock().await;
                // If task already completed or downloading in active session, skip duplicate
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
            }

            let manager = self.clone();
            let output_dir_clone = output_dir.clone();

            tokio::spawn(async move {
                let _permit = manager.semaphore.acquire().await.unwrap();

                // Update status to Downloading
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
                            last_error = err;
                            // Reset downloaded bytes for retry attempt
                            {
                                let mut guard = manager.tasks.lock().await;
                                if let Some(task) = guard.get_mut(&task_id) {
                                    task.downloaded_bytes = 0;
                                }
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
                        task.status = if is_update_replacement {
                            DownloadStatus::Updated
                        } else {
                            DownloadStatus::Completed
                        };
                    } else {
                        task.status = DownloadStatus::Failed(format!("Failed after 3 retries: {}", last_error));
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

    pub async fn get_all_tasks(&self) -> Vec<DownloadTask> {
        let guard = self.tasks.lock().await;
        guard.values().cloned().collect()
    }
}
