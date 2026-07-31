use crate::client::ApiClient;
use crate::mods::get_mod;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModDetails {
    pub name: String,
    pub title: String,
    pub version: String,
    pub author: Option<String>,
    pub factorio_version: Option<String>,
    pub category: Option<String>,
    pub file_name: String,
    pub file_path: String,
    pub thumbnail: Option<String>,
    pub dependencies: Vec<String>,
    pub has_update: bool,
    pub latest_version: Option<String>,
    pub newer_versions: Vec<String>,
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

pub fn scan_installed_mods(mods_folder: &Path) -> Vec<InstalledModDetails> {
    if !mods_folder.is_dir() {
        return Vec::new();
    }

    // Collect all zip entries, then clean up: if multiple versions of the
    // same mod exist, delete the older ones from disk and keep only the newest.
    let mut by_name: std::collections::HashMap<String, Vec<InstalledModDetails>> =
        std::collections::HashMap::new();

    if let Ok(entries) = fs::read_dir(mods_folder) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("zip") {
                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

                let (mod_name, version, title, author, factorio_ver, category, deps) = if let Some(info) = read_info_json_from_zip(&path) {
                    (
                        info.name,
                        info.version,
                        info.title.unwrap_or_else(|| "".into()),
                        info.author,
                        info.factorio_version,
                        info.category,
                        info.dependencies,
                    )
                } else if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some((n, v)) = stem.rsplit_once('_') {
                        (n.to_string(), v.to_string(), n.to_string(), None, None, None, Vec::new())
                    } else {
                        (stem.to_string(), "1.0.0".to_string(), stem.to_string(), None, None, None, Vec::new())
                    }
                } else {
                    continue;
                };

                let title_final = if title.trim().is_empty() { mod_name.clone() } else { title };

                let detail = InstalledModDetails {
                    name: mod_name.clone(),
                    title: title_final,
                    version,
                    author,
                    factorio_version: factorio_ver,
                    category,
                    file_name,
                    file_path: path.to_string_lossy().to_string(),
                    thumbnail: None,
                    dependencies: deps,
                    has_update: false,
                    latest_version: None,
                    newer_versions: Vec::new(),
                };

                by_name.entry(mod_name).or_default().push(detail);
            }
        }
    }

    let mut installed_list = Vec::new();
    for (_name, mut versions) in by_name {
        if versions.len() > 1 {
            // Sort newest-first, then delete all but the newest from disk
            versions.sort_by(|a, b| compare_versions(&b.version, &a.version));
            for old in versions.iter().skip(1) {
                let _ = fs::remove_file(Path::new(&old.file_path));
            }
        }
        // Keep only the newest entry
        installed_list.push(versions.remove(0));
    }

    installed_list
}

pub async fn check_single_mod_update_with_client(
    api_client: &ApiClient,
    mut mod_item: InstalledModDetails,
    target_factorio_version: Option<String>,
) -> InstalledModDetails {
    match get_mod(api_client, &mod_item.name).await {
        Ok(mod_info) => {
            mod_item.category = Some(mod_info.category.clone());

            if let Some(thumb) = mod_info.thumbnail {
                let full_thumb = if thumb.starts_with("http://") || thumb.starts_with("https://") {
                    thumb
                } else {
                    format!("https://assets-mod.factorio.com{}", thumb)
                };
                mod_item.thumbnail = Some(full_thumb);
            }

            let mut compatible_versions = Vec::new();

            for rel in mod_info.releases {
                let rel_fver = rel.info_json.as_ref().and_then(|i| i.factorio_version.as_deref());
                if is_release_compatible(rel_fver, target_factorio_version.as_deref()) {
                    compatible_versions.push(rel.version);
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

            if is_explicit_target && newer.is_empty() {
                if let Some(latest_compat) = compatible_versions.first() {
                    if latest_compat != &mod_item.version {
                        newer.push(latest_compat.clone());
                    }
                }
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
        Err(_) => {}
    }
    mod_item
}

pub async fn check_updates_for_installed_mods(
    installed_mods: Vec<InstalledModDetails>,
    target_factorio_version: Option<String>,
) -> Vec<InstalledModDetails> {
    let api_client = ApiClient::new();
    let mut handles = Vec::new();

    for mod_item in installed_mods {
        let client_clone = api_client.clone();
        let target_ver = target_factorio_version.clone();
        handles.push(tokio::spawn(async move {
            check_single_mod_update_with_client(&client_clone, mod_item, target_ver).await
        }));
    }

    let mut updated_list = Vec::new();
    for handle in handles {
        if let Ok(item) = handle.await {
            updated_list.push(item);
        }
    }

    updated_list
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
