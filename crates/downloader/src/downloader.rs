use std::path::{Path, PathBuf};
use futures_util::StreamExt;
use sha1::{Digest, Sha1};
use std::time::Duration;
use tokio::time::timeout;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use factorio::client::DEFAULT_USER_AGENT;

pub const MODS_STORAGE_BASE_URL: &str = "https://mods-storage.re146.dev";
pub const INACTIVITY_TIMEOUT: Duration = Duration::from_secs(15);

pub fn build_download_url(mod_id: &str, version: &str) -> String {
    let anticache: f64 = rand::random();
    format!(
        "{}/{}/{}.zip?anticache={}",
        MODS_STORAGE_BASE_URL, mod_id, version, anticache
    )
}

pub async fn download_mod_file<F>(
    client: &reqwest::Client,
    mod_id: &str,
    version: &str,
    file_name: &str,
    expected_sha1: &str,
    output_dir: &Path,
    cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
    on_progress: F,
) -> Result<PathBuf, String>
where
    F: Fn(u64, u64) + Send + Sync + 'static,
{
    let url = build_download_url(mod_id, version);
    let send_future = client.get(&url).header("User-Agent", DEFAULT_USER_AGENT).send();
    
    let response = timeout(INACTIVITY_TIMEOUT, send_future)
        .await
        .map_err(|_| format!("Connection timeout (15s inactivity) for {}", mod_id))?
        .map_err(|e| format!("HTTP request failed for {}: {}", mod_id, e))?;

    if !response.status().is_success() {
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(format!("HTTP 404: Mod file not found on server (may be recently added) for {}", mod_id));
        }
        return Err(format!(
            "Download failed with HTTP status {} for {}",
            status,
            mod_id
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

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

    // Open temporary disk file inside .tmp folder for chunk streaming (Zero-RAM usage)
    let mut file = File::create(&temp_filepath)
        .await
        .map_err(|e| format!("Failed to create temp file for {}: {}", mod_id, e))?;

    let mut hasher = Sha1::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk_result) = timeout(INACTIVITY_TIMEOUT, stream.next())
        .await
        .map_err(|_| {
            let _ = std::fs::remove_file(&temp_filepath);
            format!("Inactivity timeout (15s) while receiving data for {}", mod_id)
        })?
    {
        if cancel_flag.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = std::fs::remove_file(&temp_filepath);
            return Err("Cancelled by user".to_string());
        }
        match chunk_result {
            Ok(chunk) => {
                downloaded += chunk.len() as u64;

                // Stream chunk directly to disk file inside .tmp directory
                if let Err(e) = file.write_all(&chunk).await {
                    let _ = std::fs::remove_file(&temp_filepath);
                    return Err(format!("Disk write error for {}: {}", mod_id, e));
                }

                // Compute SHA1 hash on the fly per chunk
                hasher.update(&chunk);
                on_progress(downloaded, total_size);
            }
            Err(e) => {
                let _ = std::fs::remove_file(&temp_filepath);
                return Err(format!("Stream read error for {}: {}", mod_id, e));
            }
        }
    }

    // Flush file buffer to disk
    if let Err(e) = file.flush().await {
        let _ = std::fs::remove_file(&temp_filepath);
        return Err(format!("Failed to flush temp file for {}: {}", mod_id, e));
    }
    drop(file);

    // SHA1 Integrity Verification
    let expected_sha1_trimmed = expected_sha1.trim();
    if !expected_sha1_trimmed.is_empty() {
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

    // Atomically move/rename from .tmp/filename.tmp -> output_dir/final_filename once verified 100% complete and intact
    tokio::fs::rename(&temp_filepath, &target_filepath)
        .await
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_filepath);
            format!("Failed to finalize file {}: {}", final_filename, e)
        })?;

    // Attempt cleanup of .tmp directory if empty
    let _ = std::fs::remove_dir(&tmp_dir);

    Ok(target_filepath)
}
