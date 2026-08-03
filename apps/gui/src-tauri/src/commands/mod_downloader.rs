use std::path::PathBuf;
use tauri::State;
use downloader::models::DownloadTask;
use downloader::queue::DownloadQueueManager;
use factorio::models::ResolvedDownloadItem;

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
    let target_dir = PathBuf::from(output_dir);
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
