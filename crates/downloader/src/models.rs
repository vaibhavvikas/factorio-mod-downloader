use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", content = "message", rename_all = "camelCase")]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Completed,
    AlreadyExists,
    Updated,
    Downgraded,
    Failed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub id: String,
    pub title: String,
    pub version: String,
    pub file_name: String,
    pub sha1: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub status: DownloadStatus,
}
