use crate::client::ApiClient;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

pub const VIRTUAL_CORE_MODS: &[(&str, &str, &str)] = &[
    ("base", "Base Game", "Core Factorio game content and data"),
    ("space-age", "Space Age", "Expansion mod adding space platforms and new planets"),
    ("quality", "Quality", "Expansion mod introducing item quality tiers"),
    ("elevated-rails", "Elevated Rails", "Expansion mod introducing elevated rail ramps and pillars"),
];

pub fn is_virtual_mod(name: &str) -> bool {
    VIRTUAL_CORE_MODS.iter().any(|(id, _, _)| *id == name)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModListJson {
    pub mods: Vec<ModListEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModListEntry {
    pub name: String,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModDetails {
    pub name: String,
    pub title: String,
    pub version: String,
    pub author: Option<String>,
    pub factorio_version: Option<String>,
    pub min_factorio_version: Option<String>,
    pub max_factorio_version: Option<String>,
    pub category: Option<String>,
    pub file_name: String,
    pub file_path: String,
    pub thumbnail: Option<String>,
    pub dependencies: Vec<String>,
    pub has_update: bool,
    pub latest_version: Option<String>,
    pub newer_versions: Vec<String>,
    #[serde(default)]
    pub is_directory: bool,
    #[serde(default)]
    pub is_virtual: bool,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfoJson {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub factorio_version: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
}

pub fn read_info_json_from_zip(zip_path: &Path) -> Option<InfoJson> {
    let file = File::open(zip_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).ok()?;
        let name = zip_file.name().to_string();
        if name.ends_with("info.json") {
            let mut content = String::new();
            zip_file.read_to_string(&mut content).ok()?;
            let parsed: InfoJson = serde_json::from_str(&content).ok()?;
            return Some(parsed);
        }
    }
    None
}

pub fn read_thumbnail_from_zip(zip_path: &Path) -> Option<String> {
    let file = File::open(zip_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).ok()?;
        let name = zip_file.name().to_string();
        if name.ends_with("thumbnail.png") {
            let mut buf = Vec::new();
            zip_file.read_to_end(&mut buf).ok()?;
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
            return Some(format!("data:image/png;base64,{}", b64));
        }
    }
    None
}

pub fn read_info_json_from_dir(dir_path: &Path) -> Option<InfoJson> {
    let info_path = dir_path.join("info.json");
    if info_path.is_file() {
        let content = fs::read_to_string(&info_path).ok()?;
        return serde_json::from_str(&content).ok();
    }
    None
}

pub fn read_thumbnail_from_dir(dir_path: &Path) -> Option<String> {
    let thumb_path = dir_path.join("thumbnail.png");
    if thumb_path.is_file() {
        if let Ok(bytes) = fs::read(&thumb_path) {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            return Some(format!("data:image/png;base64,{}", b64));
        }
    }
    None
}

/// Pure scanner: reads both .zip files and unpacked dev directories from `mods_folder`.
/// NEVER deletes or mutates any files on disk.
pub fn scan_installed_mods(mods_folder: &Path) -> Vec<InstalledModDetails> {
    if !mods_folder.is_dir() {
        return Vec::new();
    }

    let mut installed_list = Vec::new();

    let Ok(entries) = fs::read_dir(mods_folder) else {
        return Vec::new();
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

        // Ignore hidden directories like .factorio-mod-downloader
        if file_name.starts_with('.') {
            continue;
        }

        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("zip") {
            if let Some(info) = read_info_json_from_zip(&path) {
                let thumbnail = read_thumbnail_from_zip(&path);
                let title = info.title.filter(|t| !t.trim().is_empty()).unwrap_or_else(|| info.name.clone());

                installed_list.push(InstalledModDetails {
                    name: info.name,
                    title,
                    version: info.version,
                    author: info.author,
                    factorio_version: info.factorio_version,
                    min_factorio_version: None,
                    max_factorio_version: None,
                    category: info.category,
                    file_name,
                    file_path: path.to_string_lossy().to_string(),
                    thumbnail,
                    dependencies: info.dependencies,
                    has_update: false,
                    latest_version: None,
                    newer_versions: Vec::new(),
                    is_directory: false,
                    is_virtual: false,
                    enabled: false,
                });
            }
        } else if path.is_dir() {
            if let Some(info) = read_info_json_from_dir(&path) {
                let thumbnail = read_thumbnail_from_dir(&path);
                let title = info.title.filter(|t| !t.trim().is_empty()).unwrap_or_else(|| info.name.clone());

                installed_list.push(InstalledModDetails {
                    name: info.name,
                    title,
                    version: info.version,
                    author: info.author,
                    factorio_version: info.factorio_version,
                    min_factorio_version: None,
                    max_factorio_version: None,
                    category: info.category,
                    file_name,
                    file_path: path.to_string_lossy().to_string(),
                    thumbnail,
                    dependencies: info.dependencies,
                    has_update: false,
                    latest_version: None,
                    newer_versions: Vec::new(),
                    is_directory: true,
                    is_virtual: false,
                    enabled: false,
                });
            }
        }
    }

    installed_list
}

/// Read `mod-list.json` from the given mods folder.
pub fn read_mod_list(mods_folder: &Path) -> Result<ModListJson, std::io::Error> {
    let mod_list_path = mods_folder.join("mod-list.json");
    if !mod_list_path.is_file() {
        return Ok(ModListJson {
            mods: vec![ModListEntry {
                name: "base".to_string(),
                enabled: true,
                version: None,
            }],
        });
    }

    let content = fs::read_to_string(&mod_list_path)?;
    let parsed: ModListJson = serde_json::from_str(&content)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    Ok(parsed)
}

/// Atomically write `mod-list.json` with an optional rolling backup.
/// Guarantees that `base` is included and enabled.
pub fn write_mod_list_atomic(
    mods_folder: &Path,
    mut mod_list: ModListJson,
    backup_dir: Option<&Path>,
) -> Result<(), std::io::Error> {
    // Ensure "base" is present and enabled
    if let Some(base_entry) = mod_list.mods.iter_mut().find(|m| m.name == "base") {
        base_entry.enabled = true;
    } else {
        mod_list.mods.insert(
            0,
            ModListEntry {
                name: "base".to_string(),
                enabled: true,
                version: None,
            },
        );
    }

    let mod_list_path = mods_folder.join("mod-list.json");

    // Optional rolling backup
    if let Some(backup_root) = backup_dir {
        let _ = fs::create_dir_all(backup_root);
        if mod_list_path.is_file() {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let backup_file = backup_root.join(format!("mod-list_{}.json", timestamp));
            let _ = fs::copy(&mod_list_path, &backup_file);

            // Keep max 10 backups
            if let Ok(entries) = fs::read_dir(backup_root) {
                let mut backups: Vec<_> = entries
                    .flatten()
                    .filter(|e| e.path().is_file() && e.file_name().to_string_lossy().starts_with("mod-list_"))
                    .collect();
                if backups.len() > 10 {
                    backups.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
                    for old in backups.iter().take(backups.len() - 10) {
                        let _ = fs::remove_file(old.path());
                    }
                }
            }
        }
    }

    let tmp_path = mods_folder.join("mod-list.json.tmp");
    let serialized = serde_json::to_string_pretty(&mod_list)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    fs::write(&tmp_path, serialized)?;
    fs::rename(&tmp_path, &mod_list_path)?;
    Ok(())
}

/// Check updates for installed mods using the high-performance batch `namelist` API.
pub async fn check_updates_for_installed_mods(
    mut installed_mods: Vec<InstalledModDetails>,
    target_factorio_version: Option<String>,
) -> Vec<InstalledModDetails> {
    let api_client = ApiClient::new();
    let mod_names: Vec<String> = installed_mods
        .iter()
        .filter(|m| !is_virtual_mod(&m.name))
        .map(|m| m.name.clone())
        .collect();

    if let Ok(namelist_results) = crate::mods::get_mods_by_namelist(&api_client, &mod_names).await {
        let mut lookup = std::collections::HashMap::new();
        for item in namelist_results {
            lookup.insert(item.name.clone(), item);
        }

        for mod_item in &mut installed_mods {
            if let Some(info) = lookup.get(&mod_item.name) {
                if mod_item.category.is_none() {
                    mod_item.category = info.category.clone();
                }

                let mut all_fver_strings: Vec<String> = info
                    .releases
                    .iter()
                    .filter_map(|rel| rel.info_json.as_ref()?.factorio_version.as_deref().map(|s| s.to_string()))
                    .collect();

                if !all_fver_strings.is_empty() {
                    all_fver_strings.sort_by(|a, b| compare_versions(a, b));
                    mod_item.min_factorio_version = Some(all_fver_strings.first().cloned().unwrap_or_default());
                    mod_item.max_factorio_version = Some(all_fver_strings.last().cloned().unwrap_or_default());
                }

                let mut compatible_versions = Vec::new();
                for rel in &info.releases {
                    let rel_fver = rel.info_json.as_ref().and_then(|i| i.factorio_version.as_deref());
                    if is_release_compatible(rel_fver, target_factorio_version.as_deref()) {
                        compatible_versions.push(rel.version.clone());
                    }
                }

                compatible_versions.sort_by(|a, b| compare_versions(b, a));

                let mut newer = Vec::new();
                for ver in &compatible_versions {
                    if compare_versions(ver, &mod_item.version).is_gt() {
                        newer.push(ver.clone());
                    }
                }

                let is_explicit_target = target_factorio_version.as_deref().map(|t| {
                    let clean = t.trim().to_lowercase();
                    !clean.is_empty() && clean != "all" && clean != "any"
                }).unwrap_or(false);

                if is_explicit_target && newer.is_empty()
                    && let Some(latest_compat) = compatible_versions.first()
                    && latest_compat != &mod_item.version
                {
                    newer.push(latest_compat.clone());
                }

                let latest_ver = newer.first().cloned().or_else(|| compatible_versions.first().cloned());

                if !newer.is_empty() {
                    mod_item.has_update = true;
                    mod_item.latest_version = latest_ver;
                    mod_item.newer_versions = newer;
                } else {
                    mod_item.has_update = false;
                    mod_item.latest_version = latest_ver;
                    mod_item.newer_versions = compatible_versions;
                }
            }
        }
    }

    installed_mods
}

/// Backwards-compatible helper for single mod update check.
pub async fn check_single_mod_update_with_client(
    _api_client: &ApiClient,
    mod_item: InstalledModDetails,
    target_factorio_version: Option<String>,
) -> InstalledModDetails {
    let list = check_updates_for_installed_mods(vec![mod_item], target_factorio_version).await;
    list.into_iter().next().unwrap()
}

pub fn is_release_compatible(rel_fver: Option<&str>, target_fver: Option<&str>) -> bool {
    let Some(target) = target_fver else { return true; };
    let target_clean = target.trim().to_lowercase();
    if target_clean.is_empty() || target_clean == "all" || target_clean == "any" {
        return true;
    }
    let Some(rel) = rel_fver else { return true; };
    let rel_clean = rel.trim().to_lowercase();
    rel_clean == target_clean || rel_clean.starts_with(&target_clean) || target_clean.starts_with(&rel_clean)
}

pub fn delete_mod_file(file_path: &Path) -> Result<(), String> {
    if file_path.is_file() {
        fs::remove_file(file_path).map_err(|e| format!("Failed to delete mod file: {}", e))?;
    } else if file_path.is_dir() {
        fs::remove_dir_all(file_path).map_err(|e| format!("Failed to delete mod directory: {}", e))?;
    }
    Ok(())
}

pub fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    fn parse_ver(v: &str) -> Vec<u32> {
        v.split('.')
            .map(|s| s.parse::<u32>().unwrap_or(0))
            .collect()
    }

    let left_parts = parse_ver(left);
    let right_parts = parse_ver(right);
    let max_len = left_parts.len().max(right_parts.len());

    for index in 0..max_len {
        match left_parts.get(index).unwrap_or(&0).cmp(right_parts.get(index).unwrap_or(&0)) {
            std::cmp::Ordering::Equal => continue,
            ordering => return ordering,
        }
    }

    std::cmp::Ordering::Equal
}
