//! API response models.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfo {
    pub name: String,
    pub title: String,
    pub owner: String,
    pub category: String,
    pub summary: String,
    pub thumbnail: Option<String>,
    pub updated_at: String,
    pub downloads_count: u64,
    pub releases: Vec<Release>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub download_url: String,
    pub file_name: String,
    pub info_json: Option<InfoJson>,
    pub released_at: String,
    pub sha1: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfoJson {
    pub dependencies: Option<Vec<String>>,
    pub factorio_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedDownloadItem {
    pub id: String,
    pub title: String,
    pub version: String,
    pub file_name: String,
    pub sha1: String,
}
