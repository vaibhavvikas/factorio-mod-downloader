use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashedModVersion {
    pub version: String,
    pub file_name: String,
    pub file_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthIssue {
    pub kind: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModGroup {
    pub name: String,
    pub title: String,
    pub author: Option<String>,
    pub category: Option<String>,
    pub thumbnail: Option<String>,
    pub enabled: bool,
    pub is_virtual: bool,
    pub is_directory: bool,
    pub active_version: String,
    pub active_file_path: Option<String>,
    pub factorio_version: Option<String>,
    pub stashed_versions: Vec<StashedModVersion>,
    pub dependencies: Vec<String>,
    pub has_update: bool,
    pub latest_version: Option<String>,
    pub health_issues: Vec<HealthIssue>,
    pub pinned: bool,
    pub pinned_policy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManifestModEntry {
    #[serde(default)]
    pub installed_at: Option<String>,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub pinned_policy: Option<String>,
    #[serde(default)]
    pub pinned_by_profile_id: Option<String>,
    #[serde(default)]
    pub active_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstalledManifest {
    #[serde(default)]
    pub mods: HashMap<String, ManifestModEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileModEntry {
    pub name: String,
    pub version: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, alias = "factorio_version")]
    pub factorio_version: Option<String>,
    #[serde(default, alias = "created_at")]
    pub created_at: String,
    #[serde(default, alias = "updated_at")]
    pub updated_at: String,
    pub mods: Vec<ProfileModEntry>,
    #[serde(default, alias = "has_settings_snapshot")]
    pub has_settings_snapshot: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallPreview {
    pub targets: Vec<String>,
    pub cascade_removals: Vec<String>,
    pub kept_dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GroupKind {
    Group,
    Standalone,
    Shared,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AggregateState {
    All,
    Some,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupAggregate {
    pub enabled: usize,
    pub total: usize,
    pub state: AggregateState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ReferenceKind {
    Requires,
    Uses,
    RequiredBy,
    UsedBy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ModReference {
    pub kind: ReferenceKind,
    pub target_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_mod: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
}

pub type Ref = ModReference;
pub type RefKind = ReferenceKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChildNode {
    #[serde(flatten)]
    pub mod_data: InstalledModGroup,
    pub depth: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub via: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>, // 'optional' | 'unused'
    #[serde(default)]
    pub missing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraint: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub references: Vec<ModReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModGroupGraph {
    pub id: String, // root name or "shared-libraries"
    pub kind: GroupKind, // 'group' | 'standalone' | 'shared'
    pub root: Option<InstalledModGroup>, // None if shared, or InstalledModGroup for root
    pub children: Vec<ChildNode>,
    pub references: Vec<ModReference>,
    pub aggregate: GroupAggregate,
    pub health: Vec<HealthIssue>,
    pub update_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadBatchKind {
    Single,
    Queue,
    Update,
    CollectionApply,
    Import,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadBatchPhase {
    Downloading,
    Verifying,
    Installing,
    Done,
    Failed,
    Cancelled,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadItemState {
    Queued,
    Connecting,
    Downloading,
    Paused,
    Verifying,
    Downloaded,
    Installed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItemNode {
    pub id: String,
    pub batch_id: String,
    pub name: String,
    pub version: String,
    pub title: String,
    pub reason: String, // 'direct' | 'dependency'
    pub requested_by: Vec<String>,
    pub position: usize,
    pub state: DownloadItemState,
    pub bytes_total: u64,
    pub bytes_done: u64,
    pub speed: String,
    pub error: Option<String>,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    pub sha1: String,
    pub depth: usize,
    pub via: Option<String>,
    pub is_root: bool,
    pub subtitle: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadBatch {
    pub id: String,
    pub kind: DownloadBatchKind,
    pub label: String,
    pub created_at: u64,
    pub phase: DownloadBatchPhase,
    pub error: Option<String>,
    pub items: Vec<DownloadItemNode>,
}
