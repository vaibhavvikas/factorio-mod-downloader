use crate::features::config::{get_app_config, get_config_dir, get_mods_folder};
use mod_manager::{
    apply_collection as crate_apply_collection, delete_collection as crate_delete_collection,
    list_collections, save_collection as crate_save_collection, CollectionProfile,
};
use std::fs;
use std::path::PathBuf;

fn sanitize_name(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    if sanitized.trim_matches('_').is_empty() {
        "collection".to_string()
    } else {
        sanitized
    }
}

fn resolve_paths() -> Result<(PathBuf, PathBuf), String> {
    let mods_folder_str = get_mods_folder()?.ok_or_else(|| "Mods folder is not configured".to_string())?;
    let mods_folder = PathBuf::from(mods_folder_str);
    let app_data_dir = get_config_dir()?;
    Ok((mods_folder, app_data_dir))
}

#[tauri::command]
pub fn get_collections() -> Result<Vec<CollectionProfile>, String> {
    let app_data_dir = get_config_dir()?;
    let mut profiles = list_collections(&app_data_dir);
    if profiles.is_empty() {
        let (mods_folder, mods) = if let Ok(Some(folder_str)) = get_mods_folder() {
            let folder = PathBuf::from(&folder_str);
            if let Ok(mod_list) = factorio::installed::read_mod_list(&folder) {
                let m_list = mod_list
                    .mods
                    .into_iter()
                    .filter(|m| m.enabled && m.name != "base")
                    .map(|m| mod_manager::models::ProfileModEntry {
                        name: m.name,
                        enabled: true,
                        version: m.version.unwrap_or_else(|| "0.0.0".to_string()),
                    })
                    .collect();
                (folder, m_list)
            } else {
                (folder, Vec::new())
            }
        } else {
            (PathBuf::from("."), Vec::new())
        };

        let config = get_app_config().unwrap_or_default();
        let factorio_ver = config.factorio_version.filter(|v| !v.is_empty() && v != "any");

        let default_profile = CollectionProfile {
            id: "default".to_string(),
            name: "Default Profile".to_string(),
            description: Some("Automatic baseline snapshot of installed mods".to_string()),
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            factorio_version: factorio_ver,
            mods,
            has_settings_snapshot: false,
        };
        if let Ok(saved) = crate_save_collection(&mods_folder, &app_data_dir, default_profile, false) {
            profiles.push(saved);
        }
    } else if let Some(default_profile) = profiles.iter_mut().find(|p| p.id == "default") {
        if default_profile.factorio_version.is_none() {
            if let Ok(config) = get_app_config() {
                if let Some(fv) = config.factorio_version.filter(|v| !v.is_empty() && v != "any") {
                    default_profile.factorio_version = Some(fv);
                    let (mods_folder, _) = resolve_paths().unwrap_or_else(|_| (PathBuf::from("."), app_data_dir.clone()));
                    let _ = crate_save_collection(&mods_folder, &app_data_dir, default_profile.clone(), false);
                }
            }
        }
    }
    Ok(profiles)
}

#[tauri::command]
pub fn save_collection(profile: CollectionProfile, snapshot_settings: bool) -> Result<CollectionProfile, String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    crate_save_collection(&mods_folder, &app_data_dir, profile, snapshot_settings)
}

#[tauri::command]
pub fn delete_collection(profile_id: String) -> Result<(), String> {
    if profile_id == "default" {
        return Err("Cannot delete the default profile".to_string());
    }
    let (_, app_data_dir) = resolve_paths()?;
    crate_delete_collection(&app_data_dir, &profile_id)
}

#[tauri::command]
pub fn apply_collection(profile_id: String, disable_other_mods: Option<bool>) -> Result<(), String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    let disable_others = disable_other_mods.unwrap_or(true);
    crate_apply_collection(&mods_folder, &app_data_dir, &profile_id, disable_others)
}

#[tauri::command]
pub fn export_collection_json(profile_id: String) -> Result<String, String> {
    let (_, app_data_dir) = resolve_paths()?;
    let dir = mod_manager::collections_dir(&app_data_dir);
    let path = dir.join(format!("{}.json", profile_id));
    if !path.is_file() {
        return Err("Collection profile not found.".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Failed to read profile: {}", e))
}

#[tauri::command]
pub async fn export_collection_dialog(profile_id: String) -> Result<Option<String>, String> {
    let (_, app_data_dir) = resolve_paths()?;
    let dir = mod_manager::collections_dir(&app_data_dir);
    let path = dir.join(format!("{}.json", profile_id));
    if !path.is_file() {
        return Err("Collection profile not found.".to_string());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read profile: {}", e))?;
    let profile: CollectionProfile = serde_json::from_str(&content).map_err(|e| format!("Invalid profile: {}", e))?;

    let file_handle = rfd::AsyncFileDialog::new()
        .set_title("Export Collection Profile")
        .set_file_name(format!("{}.json", sanitize_name(&profile.name)))
        .add_filter("JSON Files", &["json"])
        .save_file()
        .await;

    if let Some(file) = file_handle {
        let export_path = file.path().to_path_buf();
        fs::write(&export_path, &content).map_err(|e| format!("Failed to export collection: {}", e))?;
        Ok(Some(export_path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn import_collection_from_json(json_str: String) -> Result<CollectionProfile, String> {
    let (mods_folder, app_data_dir) = resolve_paths()?;
    let mut profile: CollectionProfile = serde_json::from_str(&json_str)
        .map_err(|e| format!("Invalid collection JSON: {}", e))?;

    let ts = chrono::Utc::now().timestamp_millis();
    let safe_name = sanitize_name(&profile.name);
    profile.id = format!("profile_{}_{}", ts, safe_name);
    profile.has_settings_snapshot = false;
    crate_save_collection(&mods_folder, &app_data_dir, profile, false)
}

#[tauri::command]
pub async fn import_collection_dialog() -> Result<Option<CollectionProfile>, String> {
    let file_handle = rfd::AsyncFileDialog::new()
        .set_title("Import Collection Profile")
        .add_filter("JSON Files", &["json"])
        .pick_file()
        .await;

    if let Some(file) = file_handle {
        let content = fs::read_to_string(file.path()).map_err(|e| format!("Failed to read file: {}", e))?;
        let profile = import_collection_from_json(content)?;
        Ok(Some(profile))
    } else {
        Ok(None)
    }
}
