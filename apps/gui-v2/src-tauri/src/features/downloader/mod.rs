use std::path::PathBuf;
use tauri::State;

pub mod batch;

use downloader::models::DownloadTask;
use downloader::queue::DownloadQueueManager;
use factorio::models::ResolvedDownloadItem;
use mod_manager::models::DownloadBatch;
use batch::{compute_batches_from_tasks, load_persisted_batches, save_persisted_batches};

#[derive(Default)]
pub struct DownloaderState {
    pub manager: DownloadQueueManager,
}

impl DownloaderState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[tauri::command]
pub async fn start_download_batch(
    state: State<'_, DownloaderState>,
    items: Vec<ResolvedDownloadItem>,
    output_dir: String,
) -> Result<(), String> {
    let target_dir = PathBuf::from(&output_dir);
    if let Ok(app_data_dir) = crate::features::config::get_config_dir() {
        for item in &items {
            let _ = mod_manager::manifest::record_mod_installed(
                &app_data_dir,
                &item.id,
                Some(item.version.clone()),
            );
        }
    }
    state.manager.enqueue_batch(items, target_dir).await;
    Ok(())
}

#[tauri::command]
pub async fn get_download_tasks(
    state: State<'_, DownloaderState>,
) -> Result<Vec<DownloadTask>, String> {
    Ok(state.manager.get_all_tasks().await)
}

#[tauri::command]
pub async fn clear_completed_download_tasks(
    state: State<'_, DownloaderState>,
) -> Result<(), String> {
    state.manager.clear_completed().await;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn remove_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
) -> Result<(), String> {
    state.manager.remove_task(&taskId).await;

    let mut persisted = load_persisted_batches();
    let mut modified = false;
    for b in &mut persisted {
        let before_len = b.items.len();
        b.items.retain(|item| {
            item.name != taskId && item.id != taskId && !item.id.starts_with(&format!("{}_", taskId))
        });
        if b.items.len() != before_len {
            modified = true;
        }
    }
    if modified {
        persisted.retain(|b| !b.items.is_empty());
        let _ = save_persisted_batches(&persisted);
    }

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn retry_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
    outputDir: String,
) -> Result<(), String> {
    let target_dir = PathBuf::from(outputDir);
    state.manager.retry_task(&taskId, target_dir).await;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn cancel_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
) -> Result<(), String> {
    state.manager.cancel_task(&taskId).await;
    Ok(())
}

#[tauri::command]
pub async fn cancel_all_download_tasks(
    state: State<'_, DownloaderState>,
) -> Result<(), String> {
    state.manager.cancel_all().await;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn pause_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
) -> Result<(), String> {
    state.manager.pause_task(&taskId).await;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn resume_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
) -> Result<(), String> {
    state.manager.resume_task(&taskId).await;
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn toggle_pause_download_task(
    state: State<'_, DownloaderState>,
    taskId: String,
) -> Result<bool, String> {
    Ok(state.manager.toggle_pause_task(&taskId).await)
}

#[tauri::command]
pub async fn get_download_batches(
    state: State<'_, DownloaderState>,
) -> Result<Vec<DownloadBatch>, String> {
    let live_tasks = state.manager.get_all_tasks().await;
    let computed = compute_batches_from_tasks(&live_tasks);

    let persisted = load_persisted_batches();
    let mut batch_map: std::collections::HashMap<String, DownloadBatch> = std::collections::HashMap::new();

    // Insert persisted first
    for b in persisted {
        batch_map.insert(b.id.clone(), b);
    }

    // Overwrite or insert computed live batches
    for b in computed {
        batch_map.insert(b.id.clone(), b);
    }

    let mut result: Vec<DownloadBatch> = batch_map.into_values().collect();

    // Sort: active first, then newest first
    result.sort_by(|a, b| {
        let a_active = matches!(a.phase, mod_manager::models::DownloadBatchPhase::Downloading | mod_manager::models::DownloadBatchPhase::Paused);
        let b_active = matches!(b.phase, mod_manager::models::DownloadBatchPhase::Downloading | mod_manager::models::DownloadBatchPhase::Paused);
        match (a_active, b_active) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.created_at.cmp(&a.created_at),
        }
    });

    let _ = save_persisted_batches(&result);
    Ok(result)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn pause_download_batch(
    state: State<'_, DownloaderState>,
    batchId: String,
) -> Result<(), String> {
    let tasks = state.manager.get_all_tasks().await;
    for t in tasks {
        if t.batch_id.as_deref() == Some(&batchId) && (t.status == downloader::models::DownloadStatus::Downloading || t.status == downloader::models::DownloadStatus::Pending) {
            state.manager.pause_task(&t.id).await;
        }
    }
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn resume_download_batch(
    state: State<'_, DownloaderState>,
    batchId: String,
) -> Result<(), String> {
    let tasks = state.manager.get_all_tasks().await;
    for t in tasks {
        if t.batch_id.as_deref() == Some(&batchId) && t.status == downloader::models::DownloadStatus::Paused {
            state.manager.resume_task(&t.id).await;
        }
    }
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn cancel_download_batch(
    state: State<'_, DownloaderState>,
    batchId: String,
) -> Result<(), String> {
    let tasks = state.manager.get_all_tasks().await;
    for t in tasks {
        if t.batch_id.as_deref() == Some(&batchId) && (t.status == downloader::models::DownloadStatus::Downloading || t.status == downloader::models::DownloadStatus::Pending || t.status == downloader::models::DownloadStatus::Paused) {
            state.manager.cancel_task(&t.id).await;
        }
    }
    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn retry_download_batch(
    state: State<'_, DownloaderState>,
    batchId: String,
    outputDir: String,
) -> Result<(), String> {
    let tasks = state.manager.get_all_tasks().await;
    let target_dir = PathBuf::from(outputDir);
    for t in tasks {
        if t.batch_id.as_deref() == Some(&batchId) {
            if let downloader::models::DownloadStatus::Failed(_) = t.status {
                state.manager.retry_task(&t.id, target_dir.clone()).await;
            }
        }
    }
    Ok(())
}
