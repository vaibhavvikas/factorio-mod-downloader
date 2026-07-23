use std::fs;
use std::path::{Path, PathBuf};
use futures_util::StreamExt;
use sha1::{Digest, Sha1};

use std::time::Duration;
use tokio::time::timeout;

pub const MODS_STORAGE_BASE_URL: &str = "https://mods-storage.re146.dev";
pub const DEFAULT_USER_AGENT: &str = "FactorioModDownloader/1.0";
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
        return Err(format!(
            "Download failed with HTTP status {} for {}",
            response.status(),
            mod_id
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut bytes = Vec::with_capacity(total_size as usize);

    let mut stream = response.bytes_stream();

    loop {
        let chunk_option = timeout(INACTIVITY_TIMEOUT, stream.next())
            .await
            .map_err(|_| format!("Inactivity timeout (15s) while receiving data for {}", mod_id))?;

        match chunk_option {
            Some(Ok(chunk)) => {
                downloaded += chunk.len() as u64;
                bytes.extend_from_slice(&chunk);
                on_progress(downloaded, total_size);
            }
            Some(Err(e)) => return Err(format!("Stream read error for {}: {}", mod_id, e)),
            None => break,
        }
    }

    // SHA1 Integrity Verification
    let expected_sha1_trimmed = expected_sha1.trim();
    if !expected_sha1_trimmed.is_empty() {
        let mut hasher = Sha1::new();
        hasher.update(&bytes);
        let result = hasher.finalize();
        let computed_sha1 = format!("{:x}", result);

        if computed_sha1.to_lowercase() != expected_sha1_trimmed.to_lowercase() {
            return Err(format!(
                "SHA1 checksum verification failed for {}: expected {}, computed {}",
                mod_id, expected_sha1_trimmed, computed_sha1
            ));
        }
    }

    // Write file to output directory
    fs::create_dir_all(output_dir).map_err(|e| format!("Failed to create destination folder: {}", e))?;

    let final_filename = if file_name.trim().is_empty() {
        format!("{}_{}.zip", mod_id, version)
    } else {
        file_name.trim().to_string()
    };

    let target_filepath = output_dir.join(&final_filename);
    fs::write(&target_filepath, &bytes).map_err(|e| format!("Failed to save file {}: {}", final_filename, e))?;

    Ok(target_filepath)
}
