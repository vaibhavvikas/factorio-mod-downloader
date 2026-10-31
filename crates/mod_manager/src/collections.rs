use crate::models::CollectionProfile;
use crate::process::is_factorio_running;
use factorio::installed::{write_mod_list_atomic, ModListEntry, ModListJson};
use std::fs;
use std::path::{Path, PathBuf};

pub fn collections_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("collections")
}

pub fn list_collections(app_data_dir: &Path) -> Vec<CollectionProfile> {
    let dir = collections_dir(app_data_dir);
    if !dir.is_dir() {
        return Vec::new();
    }

    let mut profiles = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&p) {
                    if let Ok(profile) = serde_json::from_str::<CollectionProfile>(&content) {
                        profiles.push(profile);
                    }
                }
            }
        }
    }

    profiles.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    profiles
}

pub fn save_collection(
    mods_folder: &Path,
    app_data_dir: &Path,
    mut profile: CollectionProfile,
    snapshot_settings: bool,
) -> Result<CollectionProfile, String> {
    let dir = collections_dir(app_data_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create collections directory: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    if profile.created_at.is_empty() {
        profile.created_at = now.clone();
    }
    profile.updated_at = now;

    // Collections only record enabled mods (core "base" is implicit)
    profile.mods.retain(|m| m.enabled && m.name != "base");

    if snapshot_settings {
        let settings_src = mods_folder.join("mod-settings.dat");
        if settings_src.is_file() {
            let settings_dst = dir.join(format!("{}.settings.dat", profile.id));
            let _ = fs::copy(&settings_src, &settings_dst);
            profile.has_settings_snapshot = true;
        }
    }

    let file_path = dir.join(format!("{}.json", profile.id));
    let json = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("Failed to serialize profile: {}", e))?;

    fs::write(&file_path, json).map_err(|e| format!("Failed to save profile: {}", e))?;
    Ok(profile)
}

pub fn delete_collection(app_data_dir: &Path, profile_id: &str) -> Result<(), String> {
    let dir = collections_dir(app_data_dir);
    let profile_file = dir.join(format!("{}.json", profile_id));
    if profile_file.is_file() {
        let _ = fs::remove_file(profile_file);
    }
    let settings_file = dir.join(format!("{}.settings.dat", profile_id));
    if settings_file.is_file() {
        let _ = fs::remove_file(settings_file);
    }
    Ok(())
}

/// Apply a profile to `mod-list.json` and optionally restore its `mod-settings.dat`.
pub fn apply_collection(
    mods_folder: &Path,
    app_data_dir: &Path,
    profile_id: &str,
    disable_other_mods: bool,
) -> Result<(), String> {
    if is_factorio_running() {
        return Err("Cannot apply collection while Factorio is running.".to_string());
    }

    let dir = collections_dir(app_data_dir);
    let profile_file = dir.join(format!("{}.json", profile_id));
    if !profile_file.is_file() {
        return Err("Collection profile not found.".to_string());
    }

    let content = fs::read_to_string(&profile_file)
        .map_err(|e| format!("Failed to read profile: {}", e))?;
    let profile: CollectionProfile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse profile: {}", e))?;

    // Read existing mod-list.json to resolve installed mods and their state
    let current_mod_list = factorio::installed::read_mod_list(mods_folder).unwrap_or(ModListJson {
        mods: Vec::new(),
    });

    let profile_mods_map: std::collections::HashMap<String, String> = profile
        .mods
        .into_iter()
        .filter(|m| m.enabled && m.name != "base")
        .map(|m| (m.name, m.version))
        .collect();

    let mut new_entries = Vec::new();
    new_entries.push(ModListEntry {
        name: "base".to_string(),
        enabled: true,
        version: None,
    });

    // Add all mods in the profile as enabled
    for (mod_name, mod_ver) in &profile_mods_map {
        let stash_root = crate::grouping::stash_dir(mods_folder);
        let mod_stash_dir = stash_root.join(mod_name);

        if !mod_ver.is_empty() && mod_ver != "latest" {
            let _ = crate::versioning::set_active_mod_version(mods_folder, app_data_dir, mod_name, mod_ver);
        } else if mod_stash_dir.is_dir() {
            // If no specific version requested, check if root has an active version.
            // If root has no active version, activate the latest stashed version!
            let has_active_in_root = std::fs::read_dir(mods_folder).map(|entries| {
                entries.flatten().any(|e| {
                    let p = e.path();
                    p.is_file() && p.extension().and_then(|ext| ext.to_str()) == Some("zip")
                        && factorio::installed::read_info_json_from_zip(&p).map(|info| info.name == *mod_name).unwrap_or(false)
                })
            }).unwrap_or(false);

            if !has_active_in_root {
                if let Ok(entries) = std::fs::read_dir(&mod_stash_dir) {
                    let mut stashed_vers: Vec<String> = entries
                        .flatten()
                        .filter(|e| e.path().is_dir())
                        .map(|e| e.file_name().to_string_lossy().to_string())
                        .collect();
                    stashed_vers.sort_by(|a, b| factorio::installed::compare_versions(b, a));
                    if let Some(highest_ver) = stashed_vers.first() {
                        let _ = crate::versioning::set_active_mod_version(mods_folder, app_data_dir, mod_name, highest_ver);
                    }
                }
            }
        }

        new_entries.push(ModListEntry {
            name: mod_name.clone(),
            enabled: true,
            version: if mod_ver.is_empty() || mod_ver == "latest" {
                None
            } else {
                Some(mod_ver.clone())
            },
        });
    }

    // Other mods previously installed/in mod-list.json that are not in the profile:
    // If disable_other_mods is true, they are disabled. Otherwise, keep their current enabled state.
    for existing in current_mod_list.mods {
        if existing.name == "base" || profile_mods_map.contains_key(&existing.name) {
            continue;
        }
        new_entries.push(ModListEntry {
            name: existing.name,
            enabled: if disable_other_mods { false } else { existing.enabled },
            version: existing.version,
        });
    }

    let backup_dir = app_data_dir.join("backups").join("mod-list");
    write_mod_list_atomic(mods_folder, ModListJson { mods: new_entries }, Some(&backup_dir))
        .map_err(|e| format!("Failed to write mod-list.json: {}", e))?;

    // Restore mod-settings.dat if snapshot exists
    if profile.has_settings_snapshot {
        let settings_snap = dir.join(format!("{}.settings.dat", profile.id));
        if settings_snap.is_file() {
            let _ = fs::copy(&settings_snap, mods_folder.join("mod-settings.dat"));
        }
    }

    Ok(())
}
