use crate::features::config::{get_config_dir, get_mods_folder};
use factorio::installed::{read_mod_list, write_mod_list_atomic, ModListEntry, ModListJson};
use mod_manager::{
    delete_stashed_version, execute_uninstall, get_installed_mod_groups as crate_get_groups,
    get_storage_usage, is_factorio_running as crate_is_factorio_running, preview_uninstall,
    register_and_enable_mod_group as crate_register_group,
    set_active_mod_version as crate_set_active_ver, InstalledModGroup, StorageUsage,
    UninstallPreview,
};
use std::path::PathBuf;

fn resolve_paths() -> Result<(PathBuf, PathBuf), String> {
    let mods_folder_str = get_mods_folder()?.ok_or_else(|| "Mods folder is not configured".to_string())?;
    let mods_folder = PathBuf::from(mods_folder_str);
    let app_data_dir = get_config_dir()?;
    Ok((mods_folder, app_data_dir))
}

#[tauri::command]
pub fn get_installed_mod_groups() -> Result<Vec<InstalledModGroup>, String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    Ok(crate_get_groups(&mods_folder, &app_data_dir))
}

#[tauri::command]
pub fn get_installed_mod_groups_graph() -> Result<Vec<mod_manager::ModGroupGraph>, String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    Ok(mod_manager::get_installed_mod_groups_graph(&mods_folder, &app_data_dir))
}

#[tauri::command]
pub fn toggle_mod_enabled(mod_name: String, enabled: bool) -> Result<(), String> {
    if factorio::installed::is_virtual_mod(&mod_name) {
        return Err("Core game and official DLC mods cannot be modified.".to_string());
    }

    let (mods_folder, app_data_dir) = resolve_paths()?;

    let mut mod_list = read_mod_list(&mods_folder).unwrap_or_else(|_| ModListJson {
        mods: vec![ModListEntry {
            name: "base".to_string(),
            enabled: true,
            version: None,
        }],
    });

    if let Some(entry) = mod_list.mods.iter_mut().find(|m| m.name == mod_name) {
        entry.enabled = enabled;
    } else {
        mod_list.mods.push(ModListEntry {
            name: mod_name,
            enabled,
            version: None,
        });
    }

    let backup_dir = app_data_dir.join("backups").join("mod-list");
    write_mod_list_atomic(&mods_folder, mod_list, Some(&backup_dir))
        .map_err(|e| format!("Failed to update mod-list.json: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn set_mods_enabled_batch(updates: Vec<(String, bool)>) -> Result<(), String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;

    let mut mod_list = read_mod_list(&mods_folder).unwrap_or_else(|_| ModListJson {
        mods: vec![ModListEntry {
            name: "base".to_string(),
            enabled: true,
            version: None,
        }],
    });

    for (mod_name, enabled) in updates {
        if factorio::installed::is_virtual_mod(&mod_name) {
            continue;
        }
        if let Some(entry) = mod_list.mods.iter_mut().find(|m| m.name == mod_name) {
            entry.enabled = enabled;
        } else {
            mod_list.mods.push(ModListEntry {
                name: mod_name,
                enabled,
                version: None,
            });
        }
    }

    let backup_dir = app_data_dir.join("backups").join("mod-list");
    write_mod_list_atomic(&mods_folder, mod_list, Some(&backup_dir))
        .map_err(|e| format!("Failed to update mod-list.json: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn register_and_enable_mod_group(
    parent_name: String,
    dependencies: Vec<String>,
) -> Result<(), String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    crate_register_group(&mods_folder, &app_data_dir, &parent_name, &dependencies)
}

#[tauri::command]
pub fn set_active_mod_version(mod_name: String, version: String) -> Result<(), String> {
    if factorio::installed::is_virtual_mod(&mod_name) {
        return Err("Core game and official DLC mods cannot have versions switched.".to_string());
    }
    let (mods_folder, app_data_dir) = resolve_paths()?;
    crate_set_active_ver(&mods_folder, &app_data_dir, &mod_name, &version)
}

#[tauri::command]
pub fn delete_mod_version(mod_name: String, version: String) -> Result<(), String> {
    if factorio::installed::is_virtual_mod(&mod_name) {
        return Err("Core game and official DLC mods cannot be deleted.".to_string());
    }
    let (mods_folder, _) = resolve_paths()?;
    delete_stashed_version(&mods_folder, &mod_name, &version)
}

#[tauri::command]
pub fn uninstall_mods_preview(targets: Vec<String>) -> Result<UninstallPreview, String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    Ok(preview_uninstall(&mods_folder, &app_data_dir, &targets))
}

#[tauri::command]
pub fn uninstall_mods(targets: Vec<String>, delete_stashed_too: bool) -> Result<(), String> {
    if targets.iter().any(|t| factorio::installed::is_virtual_mod(t)) {
        return Err("Core game and official DLC mods cannot be uninstalled.".to_string());
    }
    let (mods_folder, app_data_dir) = resolve_paths()?;
    execute_uninstall(&mods_folder, &app_data_dir, &targets, delete_stashed_too)
}

#[tauri::command]
pub fn get_mod_storage_usage() -> Result<StorageUsage, String> {
    let (mods_folder, _) = resolve_paths()?;
    Ok(get_storage_usage(&mods_folder))
}

#[tauri::command]
pub async fn check_mod_updates(
    target_factorio_version: Option<String>,
) -> Result<Vec<factorio::installed::InstalledModDetails>, String> {
    let (mods_folder, _) = resolve_paths()?;
    let raw_installed = factorio::installed::scan_installed_mods(&mods_folder);
    let updated = factorio::installed::check_updates_for_installed_mods(raw_installed, target_factorio_version).await;
    Ok(updated)
}

#[tauri::command]
pub fn is_factorio_running() -> bool {
    crate_is_factorio_running()
}
