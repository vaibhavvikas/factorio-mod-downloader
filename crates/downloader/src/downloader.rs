use std::path::{Path, PathBuf};
use futures_util::StreamExt;
use sha1::{Digest, Sha1};
use std::time::Duration;
use tokio::time::timeout;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use factorio::client::DEFAULT_USER_AGENT;
use crate::models::DownloadStatus;

pub const MODS_STORAGE_BASE_URL: &str = "https://mods-storage.re146.dev";
pub const INACTIVITY_TIMEOUT: Duration = Duration::from_secs(15);
pub const API_HEALTH_TIMEOUT: Duration = Duration::from_secs(5);

/// Returns true if the mods-storage API host responds to a GET request,
/// false if the connection fails or times out (offline).
pub async fn check_api_health() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(API_HEALTH_TIMEOUT)
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    match client.get(MODS_STORAGE_BASE_URL).send().await {
        Ok(_) => true,
        Err(_) => false,
    }
}

pub fn build_download_url(mod_id: &str, version: &str) -> String {
    let anticache: f64 = rand::random();
    format!(
        "{}/{}/{}.zip?anticache={}",
        MODS_STORAGE_BASE_URL, mod_id, version, anticache
    )
}

#[derive(Debug, Clone)]
pub struct DownloadRequest {
    pub mod_id: String,
    pub version: String,
    pub file_name: String,
    pub expected_sha1: String,
}

pub async fn download_mod_file<F, S>(
    client: &reqwest::Client,
    request: &DownloadRequest,
    output_dir: &Path,
    cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    pause_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    on_progress: F,
    on_status_change: S,
) -> Result<PathBuf, String>
where
    F: Fn(u64, u64) + Send + Sync + 'static,
    S: Fn(DownloadStatus) + Send + Sync + 'static,
{
    let mod_id = &request.mod_id;
    let version = &request.version;
    let file_name = &request.file_name;
    let expected_sha1 = &request.expected_sha1;

    let tmp_dir = output_dir.join(".tmp");
    tokio::fs::create_dir_all(&tmp_dir)
        .await
        .map_err(|e| format!("Failed to create temp folder: {}", e))?;

    let final_filename = if file_name.trim().is_empty() {
        format!("{}_{}.zip", mod_id, version)
    } else {
        file_name.trim().to_string()
    };

    let target_filepath = output_dir.join(&final_filename);
    let temp_filepath = tmp_dir.join(format!("{}.tmp", final_filename));

    let mut downloaded: u64 = if temp_filepath.exists() {
        std::fs::metadata(&temp_filepath).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut total_size: u64;

    'download_loop: loop {
        if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = std::fs::remove_file(&temp_filepath);
            return Err("Cancelled by user".to_string());
        }

        // Check if paused before connecting
        if pause_flag.load(std::sync::atomic::Ordering::Relaxed) {
            on_status_change(DownloadStatus::Paused);
            while pause_flag.load(std::sync::atomic::Ordering::Relaxed) {
                if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                    let _ = std::fs::remove_file(&temp_filepath);
                    return Err("Cancelled by user".to_string());
                }
                tokio::time::sleep(Duration::from_millis(150)).await;
            }
            on_status_change(DownloadStatus::Downloading);
        }

        let url = build_download_url(mod_id, version);
        let mut req = client.get(&url).header("User-Agent", DEFAULT_USER_AGENT);

        if downloaded > 0 {
            req = req.header("Range", format!("bytes={}-", downloaded));
        }

        let send_future = req.send();
        let response = timeout(INACTIVITY_TIMEOUT, send_future)
            .await
            .map_err(|_| format!("Connection timeout (15s inactivity) for {}", mod_id))?
            .map_err(|e| format!("HTTP request failed for {}: {}", mod_id, e))?;

        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(format!("HTTP 404: Mod file not found on server (may be recently added) for {}", mod_id));
        }

        let is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;
        if !status.is_success() {
            return Err(format!("Download failed with HTTP status {} for {}", status, mod_id));
        }

        // If server returned 200 OK instead of 206 Partial Content, reset downloaded offset
        if !is_partial && downloaded > 0 {
            downloaded = 0;
        }

        let content_len = response.content_length().unwrap_or(0);
        if is_partial {
            total_size = downloaded + content_len;
        } else {
            total_size = content_len;
        }

        // Open file in append mode if resuming, otherwise truncate
        let opened_file = if downloaded > 0 {
            tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&temp_filepath)
                .await
                .map_err(|e| format!("Failed to open temp file for {}: {}", mod_id, e))?
        } else {
            tokio::fs::File::create(&temp_filepath)
                .await
                .map_err(|e| format!("Failed to create temp file for {}: {}", mod_id, e))?
        };
        let mut file_opt = Some(opened_file);

        on_progress(downloaded, total_size);

        let mut stream = response.bytes_stream();
        let mut was_paused = false;

        while let Some(chunk_result) = timeout(INACTIVITY_TIMEOUT, stream.next())
            .await
            .map_err(|_| {
                format!("Inactivity timeout (15s) while receiving data for {}", mod_id)
            })?
        {
            if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                let _ = std::fs::remove_file(&temp_filepath);
                return Err("Cancelled by user".to_string());
            }

            if pause_flag.load(std::sync::atomic::Ordering::Relaxed) {
                if let Some(mut file) = file_opt.take() {
                    let _ = file.flush().await;
                }
                on_status_change(DownloadStatus::Paused);

                while pause_flag.load(std::sync::atomic::Ordering::Relaxed) {
                    if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
                        let _ = std::fs::remove_file(&temp_filepath);
                        return Err("Cancelled by user".to_string());
                    }
                    tokio::time::sleep(Duration::from_millis(150)).await;
                }

                on_status_change(DownloadStatus::Downloading);
                was_paused = true;
                break;
            }

            let chunk = chunk_result.map_err(|e| format!("Stream read error for {}: {}", mod_id, e))?;
            downloaded += chunk.len() as u64;

            if let Some(ref mut file) = file_opt
                && let Err(e) = file.write_all(&chunk).await
            {
                return Err(format!("Disk write error for {}: {}", mod_id, e));
            }

            on_progress(downloaded, total_size);
        }

        if was_paused {
            // Re-enter the download loop to resume with Range header from new offset
            continue 'download_loop;
        }

        if let Some(mut file) = file_opt.take() {
            let _ = file.flush().await;
        }

        // Download finished
        break 'download_loop;
    }

    // SHA1 Integrity Verification
    let expected_sha1_trimmed = expected_sha1.trim();
    if !expected_sha1_trimmed.is_empty() {
        let mut hasher = Sha1::new();
        let mut f = tokio::fs::File::open(&temp_filepath)
            .await
            .map_err(|e| format!("Failed to open temp file for verification: {}", e))?;
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let n = f
                .read(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read temp file for verification: {}", e))?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        let result = hasher.finalize();
        let computed_sha1 = format!("{:x}", result);

        if computed_sha1.to_lowercase() != expected_sha1_trimmed.to_lowercase() {
            let _ = std::fs::remove_file(&temp_filepath);
            return Err(format!(
                "SHA1 checksum verification failed for {}: expected {}, computed {}",
                mod_id, expected_sha1_trimmed, computed_sha1
            ));
        }
    }

    // Atomically move/rename from .tmp/filename.tmp -> output_dir/final_filename
    tokio::fs::rename(&temp_filepath, &target_filepath)
        .await
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_filepath);
            format!("Failed to finalize file {}: {}", final_filename, e)
        })?;

    let _ = std::fs::remove_dir(&tmp_dir);

    Ok(target_filepath)
}
