use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::{Mutex, Semaphore};

use common::emit_log_with_tag;
use factorio::installed::compare_versions;
use factorio::models::ResolvedDownloadItem;
use crate::downloader::{download_mod_file, DownloadRequest};
use crate::models::{DownloadStatus, DownloadTask};

pub const DEFAULT_MAX_CONCURRENT_DOWNLOADS: usize = 5;

#[derive(Clone)]
pub struct DownloadQueueManager {
    tasks: Arc<Mutex<HashMap<String, DownloadTask>>>,
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    pause_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    semaphore: Arc<Semaphore>,
    client: reqwest::Client,
}

impl Default for DownloadQueueManager {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_CONCURRENT_DOWNLOADS)
    }
}

struct ScannedInstalledMods {
    exact_files: HashMap<(String, String), PathBuf>,
    latest_by_name: HashMap<String, (String, PathBuf)>,
}

fn scan_downloaded_files(output_dir: &std::path::Path) -> ScannedInstalledMods {
    let mut exact_files = HashMap::new();
    let mut by_name: HashMap<String, Vec<(String, PathBuf)>> = HashMap::new();

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
                } else if ext == Some("zip")
                    && let Some(stem) = path.file_stem().and_then(|s| s.to_str())
                    && let Some((name, ver)) = stem.rsplit_once('_')
                {
                    exact_files.insert((name.to_string(), ver.to_string()), path.clone());
                    by_name.entry(name.to_string()).or_default().push((ver.to_string(), path.clone()));
                }
            }
        }
    }

    let mut latest_by_name = HashMap::new();
    for (name, mut list) in by_name {
        list.sort_by(|a, b| compare_versions(&b.0, &a.0));
        if let Some(highest) = list.into_iter().next() {
            latest_by_name.insert(name, highest);
        }
    }

    ScannedInstalledMods {
        exact_files,
        latest_by_name,
    }
}

impl DownloadQueueManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
            pause_flags: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            client: reqwest::Client::new(),
        }
    }

    pub async fn enqueue_batch(&self, items: Vec<ResolvedDownloadItem>, output_dir: PathBuf) {
        emit_log_with_tag("queue", "queue", &format!("Queued {} mod(s) for download", items.len()));
        let scanned = scan_downloaded_files(&output_dir);

        for item in items {
            let task_id = format!("{}_{}", item.id, item.version);
            let mut is_update_replacement = false;
            let mut is_downgrade = false;
            let mut old_installed_path: Option<PathBuf> = None;
            let mut old_installed_version: Option<String> = None;

            // 1. Check if EXACT matching mod version is already installed in target root folder
            if let Some(installed_path) = scanned.exact_files.get(&(item.id.clone(), item.version.clone())) {
                let actual_size_bytes = std::fs::metadata(installed_path)
                    .map(|m| m.len())
                    .unwrap_or(0);

                let mut guard = self.tasks.lock().await;
                let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
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
                        batch_id: item.batch_id.clone(),
                        batch_name: item.batch_name.clone(),
                        reason: item.reason.clone(),
                        requested_by: item.requested_by.clone(),
                        enqueued_at: Some(now_ms),
                    },
                );
                emit_log_with_tag("info", "mods", &format!("Mod already exists in folder: \"{}\" (v{})", item.title, item.version));
                continue;
            }

            // 2. If a DIFFERENT version of this mod is currently installed in root, mark for update/downgrade replacement
            if let Some((installed_ver, installed_path)) = scanned.latest_by_name.get(&item.id) {
                is_update_replacement = true;
                is_downgrade = compare_versions(installed_ver, &item.version).is_gt();
                old_installed_path = Some(installed_path.clone());
                old_installed_version = Some(installed_ver.clone());
            }

            let cancel_flag = Arc::new(AtomicBool::new(false));
            let pause_flag = Arc::new(AtomicBool::new(false));

            {
                let mut guard = self.tasks.lock().await;
                // Only skip if the task is actively downloading or paused
                if let Some(existing) = guard.get(&task_id)
                    && (existing.status == DownloadStatus::Downloading
                        || existing.status == DownloadStatus::Paused)
                {
                    continue;
                }

                let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
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
                        batch_id: item.batch_id.clone(),
                        batch_name: item.batch_name.clone(),
                        reason: item.reason.clone(),
                        requested_by: item.requested_by.clone(),
                        enqueued_at: Some(now_ms),
                    },
                );

                let mut flags = self.cancel_flags.lock().await;
                flags.insert(task_id.clone(), cancel_flag.clone());

                let mut pflags = self.pause_flags.lock().await;
                pflags.insert(task_id.clone(), pause_flag.clone());
            }

            let manager = self.clone();
            let output_dir_clone = output_dir.clone();
            let cancel_flag_clone = cancel_flag.clone();
            let pause_flag_clone = pause_flag.clone();

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
                emit_log_with_tag("download", "download", &format!("Downloading \"{}\" (v{})", item.title, item.version));

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
                    let task_id_status = task_id.clone();
                    let manager_progress = manager.clone();
                    let manager_status = manager.clone();

                    let request = DownloadRequest {
                        mod_id: item.id.clone(),
                        version: item.version.clone(),
                        file_name: item.file_name.clone(),
                        expected_sha1: item.sha1.clone(),
                    };

                    let result = download_mod_file(
                        &manager.client,
                        &request,
                        &output_dir_clone,
                        cancel_flag_clone.clone(),
                        pause_flag_clone.clone(),
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
                        move |status| {
                            let manager_inner = manager_status.clone();
                            let tid = task_id_status.clone();
                            tokio::spawn(async move {
                                let mut guard = manager_inner.tasks.lock().await;
                                if let Some(task) = guard.get_mut(&tid) {
                                    task.status = status;
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
                        if let (Some(old_path), Some(old_ver)) = (&old_installed_path, &old_installed_version) {
                            // Safely stash the previously active version instead of permanently deleting it
                            let stash_ver_dir = output_dir_clone
                                .join(".factorio-mod-downloader")
                                .join("versions")
                                .join(&item.id)
                                .join(old_ver);
                            let _ = std::fs::create_dir_all(&stash_ver_dir);
                            if let Some(fname) = old_path.file_name() {
                                let dest = stash_ver_dir.join(fname);
                                let _ = std::fs::rename(old_path, &dest);
                            }
                            if old_path.exists() {
                                let _ = std::fs::remove_file(old_path);
                            }
                        }
                        task.status = if is_update_replacement {
                            if is_downgrade {
                                emit_log_with_tag("warn", "warn", &format!("Downgraded mod \"{}\" to v{}", item.title, item.version));
                                DownloadStatus::Downgraded
                            } else {
                                emit_log_with_tag("success", "success", &format!("Updated mod \"{}\" to v{}", item.title, item.version));
                                DownloadStatus::Updated
                            }
                        } else {
                            emit_log_with_tag("success", "success", &format!("Downloaded successfully: \"{}\" (v{})", item.title, item.version));
                            DownloadStatus::Completed
                        };
                    } else {
                        if last_error.contains("Cancelled by user") {
                            emit_log_with_tag("warn", "cancel", &format!("Cancelled download: \"{}\" (v{})", item.title, item.version));
                        } else {
                            emit_log_with_tag("error", "error", &format!("Download failed for \"{}\" (v{}): {}", item.title, item.version, last_error));
                        }
                        task.status = DownloadStatus::Failed(last_error);
                    }
                }
            });
        }
    }

    async fn find_task_key(&self, task_id: &str) -> Option<String> {
        let guard = self.tasks.lock().await;
        if guard.contains_key(task_id) {
            Some(task_id.to_string())
        } else {
            guard
                .iter()
                .find(|(k, v)| v.id == task_id || k.starts_with(&format!("{}_", task_id)))
                .map(|(k, _)| k.clone())
        }
    }

    pub async fn clear_completed(&self) {
        let mut guard = self.tasks.lock().await;
        guard.retain(|_, task| {
            matches!(
                task.status,
                DownloadStatus::Pending
                    | DownloadStatus::Downloading
                    | DownloadStatus::Paused
                    | DownloadStatus::Failed(_)
            )
        });
        emit_log_with_tag("info", "queue", "Cleared completed tasks from download queue");
    }

    pub async fn remove_task(&self, task_id: &str) {
        let resolved_key = self.find_task_key(task_id).await;
        let key_to_clean = resolved_key.clone();

        if let Some(ref key) = key_to_clean {
            {
                let flags = self.cancel_flags.lock().await;
                if let Some(flag) = flags.get(key) {
                    flag.store(true, Ordering::Relaxed);
                }
            }
            {
                let pflags = self.pause_flags.lock().await;
                if let Some(pflag) = pflags.get(key) {
                    pflag.store(false, Ordering::Relaxed);
                }
            }
        }

        {
            let mut guard = self.tasks.lock().await;
            if let Some(ref key) = key_to_clean {
                guard.remove(key);
            }
            guard.retain(|k, v| k != task_id && v.id != task_id && !k.starts_with(&format!("{}_", task_id)));
        }

        if let Some(ref key) = key_to_clean {
            let mut cflags = self.cancel_flags.lock().await;
            cflags.remove(key);
            let mut pflags = self.pause_flags.lock().await;
            pflags.remove(key);
        }

        emit_log_with_tag("info", "queue", &format!("Removed download task \"{}\"", task_id));
    }

    pub async fn retry_task(&self, task_id: &str, output_dir: PathBuf) {
        emit_log_with_tag("queue", "retry", &format!("Retrying download task \"{}\"", task_id));
        let resolved_key = self.find_task_key(task_id).await;
        if let Some(key) = resolved_key {
            let mut guard = self.tasks.lock().await;
            if let Some(task) = guard.remove(&key) {
                let item = ResolvedDownloadItem {
                    id: task.id.clone(),
                    title: task.title.clone(),
                    version: task.version.clone(),
                    file_name: task.file_name.clone(),
                    sha1: task.sha1.clone(),
                    batch_id: task.batch_id.clone(),
                    batch_name: task.batch_name.clone(),
                    reason: task.reason.clone(),
                    requested_by: task.requested_by.clone(),
                };
                drop(guard);

                self.enqueue_batch(vec![item], output_dir).await;
            }
        }
    }

    pub async fn pause_task(&self, task_id: &str) {
        if let Some(key) = self.find_task_key(task_id).await {
            {
                let flags = self.pause_flags.lock().await;
                if let Some(flag) = flags.get(&key) {
                    flag.store(true, Ordering::Relaxed);
                }
            }
            let mut guard = self.tasks.lock().await;
            if let Some(task) = guard.get_mut(&key) {
                task.status = DownloadStatus::Paused;
            }
            emit_log_with_tag("warn", "pause", &format!("Paused download task \"{}\"", key));
        }
    }

    pub async fn resume_task(&self, task_id: &str) {
        if let Some(key) = self.find_task_key(task_id).await {
            {
                let flags = self.pause_flags.lock().await;
                if let Some(flag) = flags.get(&key) {
                    flag.store(false, Ordering::Relaxed);
                }
            }
            let mut guard = self.tasks.lock().await;
            if let Some(task) = guard.get_mut(&key) {
                task.status = DownloadStatus::Downloading;
            }
            emit_log_with_tag("info", "resume", &format!("Resumed download task \"{}\"", key));
        }
    }

    pub async fn toggle_pause_task(&self, task_id: &str) -> bool {
        if let Some(key) = self.find_task_key(task_id).await {
            let is_now_paused = {
                let flags = self.pause_flags.lock().await;
                if let Some(flag) = flags.get(&key) {
                    let prev = flag.load(Ordering::Relaxed);
                    flag.store(!prev, Ordering::Relaxed);
                    !prev
                } else {
                    false
                }
            };

            let mut guard = self.tasks.lock().await;
            if let Some(task) = guard.get_mut(&key) {
                task.status = if is_now_paused {
                    DownloadStatus::Paused
                } else {
                    DownloadStatus::Downloading
                };
            }

            if is_now_paused {
                emit_log_with_tag("warn", "pause", &format!("Paused download task \"{}\"", key));
            } else {
                emit_log_with_tag("info", "resume", &format!("Resumed download task \"{}\"", key));
            }

            is_now_paused
        } else {
            false
        }
    }

    pub async fn cancel_task(&self, task_id: &str) {
        emit_log_with_tag("warn", "cancel", &format!("Cancelled download task \"{}\"", task_id));
        if let Some(key) = self.find_task_key(task_id).await {
            {
                let flags = self.cancel_flags.lock().await;
                if let Some(flag) = flags.get(&key) {
                    flag.store(true, Ordering::Relaxed);
                }
            }
            {
                let pflags = self.pause_flags.lock().await;
                if let Some(pflag) = pflags.get(&key) {
                    pflag.store(false, Ordering::Relaxed);
                }
            }
            let mut guard = self.tasks.lock().await;
            if let Some(task) = guard.get_mut(&key) {
                task.status = DownloadStatus::Failed("Cancelled by user".to_string());
            }
        }
    }

    pub async fn cancel_all(&self) {
        emit_log_with_tag("warn", "cancel", "Cancelled all active download tasks");
        {
            let flags = self.cancel_flags.lock().await;
            for flag in flags.values() {
                flag.store(true, Ordering::Relaxed);
            }
        }
        {
            let pflags = self.pause_flags.lock().await;
            for pflag in pflags.values() {
                pflag.store(false, Ordering::Relaxed);
            }
        }
        let mut guard = self.tasks.lock().await;
        for task in guard.values_mut() {
            if matches!(
                task.status,
                DownloadStatus::Pending | DownloadStatus::Downloading | DownloadStatus::Paused
            ) {
                task.status = DownloadStatus::Failed("Cancelled by user".to_string());
            }
        }
    }

    pub async fn get_all_tasks(&self) -> Vec<DownloadTask> {
        let guard = self.tasks.lock().await;
        guard.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_remove_task() {
        let manager = DownloadQueueManager::new(2);
        let task_id = "test_mod_1.0.0".to_string();

        {
            let mut guard = manager.tasks.lock().await;
            guard.insert(
                task_id.clone(),
                DownloadTask {
                    id: "test_mod".to_string(),
                    title: "Test Mod".to_string(),
                    version: "1.0.0".to_string(),
                    file_name: "test_mod_1.0.0.zip".to_string(),
                    sha1: "abc".to_string(),
                    downloaded_bytes: 0,
                    total_bytes: 100,
                    status: DownloadStatus::Failed("Cancelled by user".to_string()),
                    batch_id: None,
                    batch_name: None,
                    reason: None,
                    requested_by: vec![],
                    enqueued_at: None,
                },
            );
        }

        assert_eq!(manager.get_all_tasks().await.len(), 1);

        // Remove by raw id "test_mod"
        manager.remove_task("test_mod").await;
        assert_eq!(manager.get_all_tasks().await.len(), 0);
    }
}
