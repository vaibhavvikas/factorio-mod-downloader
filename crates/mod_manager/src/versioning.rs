use crate::grouping::stash_dir;
use crate::manifest::{load_manifest, save_manifest};
use crate::process::is_factorio_running;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsage {
    pub root_bytes: u64,
    pub stash_bytes: u64,
    pub total_bytes: u64,
}

/// Transactionally switch the active version of a mod between mods root and stash.
pub fn set_active_mod_version(
    mods_folder: &Path,
    app_data_dir: &Path,
    mod_name: &str,
    target_version: &str,
) -> Result<(), String> {
    if is_factorio_running() {
        return Err("Cannot switch mod versions while Factorio is running. Please close the game first.".to_string());
    }

    let stash_root = stash_dir(mods_folder);
    let target_stash_ver_dir = stash_root.join(mod_name).join(target_version);

    if target_stash_ver_dir.is_dir() {
        // Find the target zip file in stash
        let mut target_zip = None;
        if let Ok(entries) = fs::read_dir(&target_stash_ver_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                    target_zip = Some(p);
                    break;
                }
            }
        }

        let target_zip_path = target_zip
            .ok_or_else(|| format!("No zip file found in stash for {} {}", mod_name, target_version))?;
        let target_file_name = target_zip_path.file_name().unwrap();
        let dest_active_path = mods_folder.join(target_file_name);

        // Find currently active zip in root, if any
        let mut current_active_zip = None;
        let mut current_active_ver = None;

        if let Ok(entries) = fs::read_dir(mods_folder) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                    if let Some(info) = factorio::installed::read_info_json_from_zip(&p) {
                        if info.name == mod_name {
                            current_active_zip = Some(p);
                            current_active_ver = Some(info.version);
                            break;
                        }
                    }
                }
            }
        }

        // Step 1: If active zip exists, move it into stash
        let mut moved_active_to_stash = None;
        if let (Some(active_path), Some(active_ver)) = (current_active_zip, current_active_ver) {
            let active_stash_dir = stash_root.join(mod_name).join(&active_ver);
            fs::create_dir_all(&active_stash_dir)
                .map_err(|e| format!("Failed to create stash directory: {}", e))?;

            let active_stash_file = active_stash_dir.join(active_path.file_name().unwrap());
            fs::rename(&active_path, &active_stash_file)
                .map_err(|e| format!("Failed to move active zip to stash: {}", e))?;

            moved_active_to_stash = Some((active_path, active_stash_file));
        }

        // Step 2: Move target zip from stash to root
        if let Err(e) = fs::rename(&target_zip_path, &dest_active_path) {
            // Rollback Step 1 if it moved
            if let Some((orig_active, stashed_file)) = moved_active_to_stash {
                let _ = fs::rename(&stashed_file, &orig_active);
            }
            return Err(format!("Failed to activate target version: {}", e));
        }

        // Clean up empty target stash dir if empty
        let _ = fs::remove_dir(&target_stash_ver_dir);
    } else {
        // Target version might be an extra duplicate zip in root
        let mut found_target_in_root = false;
        let mut other_root_zips = Vec::new();

        if let Ok(entries) = fs::read_dir(mods_folder) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                    if let Some(info) = factorio::installed::read_info_json_from_zip(&p) {
                        if info.name == mod_name {
                            if info.version == target_version {
                                found_target_in_root = true;
                            } else {
                                other_root_zips.push((p, info.version));
                            }
                        }
                    }
                }
            }
        }

        if !found_target_in_root {
            return Err(format!("Version '{}' for mod '{}' not found in stash or mods folder.", target_version, mod_name));
        }

        // Stash the other root zips for this mod
        for (other_path, other_ver) in other_root_zips {
            let other_stash_dir = stash_root.join(mod_name).join(&other_ver);
            if fs::create_dir_all(&other_stash_dir).is_ok() {
                if let Some(fname) = other_path.file_name() {
                    let dest = other_stash_dir.join(fname);
                    let _ = fs::rename(&other_path, &dest);
                }
            }
        }
    }

    // Update manifest
    let mut manifest = load_manifest(app_data_dir);
    let entry = manifest.mods.entry(mod_name.to_string()).or_default();
    entry.active_version = Some(target_version.to_string());
    let _ = save_manifest(app_data_dir, &manifest);

    Ok(())
}

/// Delete a non-active version from the stash folder permanently.
/// Refuses to delete the currently active (root) version to prevent data loss.
pub fn delete_stashed_version(
    mods_folder: &Path,
    mod_name: &str,
    version: &str,
) -> Result<(), String> {
    if is_factorio_running() {
        return Err("Cannot delete versions while Factorio is running.".to_string());
    }

    // Safety guard: refuse to delete if this version is the currently active one
    // (i.e. a matching zip exists directly in the mods root for this mod+version).
    if let Ok(entries) = std::fs::read_dir(mods_folder) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                if let Some(info) = factorio::installed::read_info_json_from_zip(&p) {
                    if info.name == mod_name && info.version == version {
                        return Err(format!(
                            "Version {} is currently active in the mods folder and cannot be deleted. Activate a different version first.",
                            version
                        ));
                    }
                }
            }
        }
    }

    let stash_ver_dir = stash_dir(mods_folder).join(mod_name).join(version);
    if stash_ver_dir.is_dir() {
        fs::remove_dir_all(&stash_ver_dir)
            .map_err(|e| format!("Failed to delete stashed version: {}", e))?;

        // If mod stash directory is empty, remove it too
        let mod_stash_dir = stash_dir(mods_folder).join(mod_name);
        if let Ok(mut entries) = fs::read_dir(&mod_stash_dir) {
            if entries.next().is_none() {
                let _ = fs::remove_dir(&mod_stash_dir);
            }
        }
    } else {
        // Check if matching extra zip in root
        let mut deleted = false;
        if let Ok(entries) = fs::read_dir(mods_folder) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                    if let Some(info) = factorio::installed::read_info_json_from_zip(&p) {
                        if info.name == mod_name && info.version == version {
                            let _ = fs::remove_file(&p);
                            deleted = true;
                            break;
                        }
                    }
                }
            }
        }

        if !deleted {
            return Err("Stashed version directory or file does not exist.".to_string());
        }
    }

    Ok(())
}

/// Compute total disk usage of active root mods and stashed versions.
pub fn get_storage_usage(mods_folder: &Path) -> StorageUsage {
    let mut root_bytes = 0u64;
    let mut stash_bytes = 0u64;

    if let Ok(entries) = fs::read_dir(mods_folder) {
        for entry in entries.flatten() {
            let p = entry.path();
            let file_name = p.file_name().unwrap_or_default().to_string_lossy();
            if file_name.starts_with('.') {
                continue;
            }
            if p.is_file() {
                root_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }

    let stash_root = stash_dir(mods_folder);
    if stash_root.is_dir() {
        fn dir_size(dir: &Path) -> u64 {
            let mut total = 0;
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        total += entry.metadata().map(|m| m.len()).unwrap_or(0);
                    } else if p.is_dir() {
                        total += dir_size(&p);
                    }
                }
            }
            total
        }
        stash_bytes = dir_size(&stash_root);
    }

    StorageUsage {
        root_bytes,
        stash_bytes,
        total_bytes: root_bytes + stash_bytes,
    }
}
