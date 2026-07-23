//! Data models for the Factorio API and Resolver.

use parser::models::Dependencies;
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
    #[serde(default)]
    pub download_url: String,
    #[serde(default)]
    pub file_name: String,
    pub info_json: Option<InfoJson>,
    #[serde(default)]
    pub released_at: String,
    #[serde(default)]
    pub sha1: String,
    #[serde(default)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModDetailsResponse {
    pub name: String,
    pub title: String,
    pub owner: String,
    pub category: String,
    pub summary: String,
    pub thumbnail: Option<String>,
    pub updated_at: String,
    pub downloads_count: u64,
    pub releases: Vec<ReleaseSummary>,
    pub default_dependencies: Dependencies,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseSummary {
    pub version: String,
    pub factorio_version: Option<String>,
    pub released_at: String,
    pub dependencies: Dependencies,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchLatestRelease {
    #[serde(default)]
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiModSearchResultItem {
    pub name: String,
    pub title: String,
    pub owner: String,
    pub summary: Option<String>,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub downloads_count: u64,
    pub thumbnail: Option<String>,
    pub latest_release: Option<SearchLatestRelease>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiModSearchResponse {
    #[serde(default)]
    pub results: Vec<ApiModSearchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModSearchResultItem {
    pub name: String,
    pub title: String,
    pub owner: String,
    pub summary: String,
    pub category: String,
    pub downloads_count: u64,
    pub thumbnail: Option<String>,
    pub latest_version: String,
    pub tags: Vec<String>,
    #[serde(default)]
    pub requires_space_age: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModSearchResponse {
    pub results: Vec<ModSearchResultItem>,
    pub page: u32,
    pub total_pages: u32,
}
