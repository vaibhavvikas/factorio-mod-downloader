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

    let mut installed_list = Vec::new();

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

                installed_list.push(InstalledModDetails {
                    name: mod_name,
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
                });
            }
        }
    }

    installed_list
}

pub async fn check_updates_for_installed_mods(
    installed_mods: Vec<InstalledModDetails>,
) -> Vec<InstalledModDetails> {
    let api_client = ApiClient::new();
    let mut updated_list = Vec::new();

    for mut mod_item in installed_mods {
        match get_mod(&api_client, &mod_item.name).await {
            Ok(mod_info) => {
                mod_item.category = Some(mod_info.category.clone());

                // `info.json` only describes the installed archive; thumbnails are
                // supplied by the Mod Portal's full-mod response. Keep the UI's
                // initials fallback until this request succeeds, then fill it in.
                if let Some(thumb) = mod_info.thumbnail {
                    let full_thumb = if thumb.starts_with("http://") || thumb.starts_with("https://") {
                        thumb
                    } else {
                        format!("https://assets-mod.factorio.com{}", thumb)
                    };
                    mod_item.thumbnail = Some(full_thumb);
                }

                let mut newer = Vec::new();

                for rel in mod_info.releases {
                    if is_newer_version(&rel.version, &mod_item.version) {
                        newer.push(rel.version);
                    }
                }

                // The API's release order is not part of the UI contract. Sort
                // explicitly so both the default target and dropdown are newest-first.
                newer.sort_by(|a, b| compare_versions(b, a));
                let latest_ver = newer.first().cloned();

                if !newer.is_empty() {
                    mod_item.has_update = true;
                    mod_item.latest_version = latest_ver;
                    mod_item.newer_versions = newer;
                }
            }
            Err(_) => {}
        }
        updated_list.push(mod_item);
    }

    updated_list
}

pub fn delete_mod_file(file_path: &Path) -> Result<(), String> {
    if file_path.is_file() {
        fs::remove_file(file_path).map_err(|e| format!("Failed to delete mod file: {}", e))?;
    }
    Ok(())
}

fn is_newer_version(new_ver: &str, current_ver: &str) -> bool {
    compare_versions(new_ver, current_ver).is_gt()
}

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
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
