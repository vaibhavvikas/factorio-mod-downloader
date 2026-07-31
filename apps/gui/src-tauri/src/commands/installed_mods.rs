use factorio::installed::{
    check_single_mod_update_with_client, check_updates_for_installed_mods, delete_mod_file,
    scan_installed_mods, InstalledModDetails,
};
use factorio::client::ApiClient;
use std::path::PathBuf;

#[tauri::command]
pub async fn get_installed_mods_info(mods_folder: String) -> Result<Vec<InstalledModDetails>, String> {
    let folder_path = PathBuf::from(&mods_folder);
    Ok(scan_installed_mods(&folder_path))
}

#[tauri::command]
pub async fn check_single_mod_update(
    api_client: tauri::State<'_, ApiClient>,
    installed_mod: InstalledModDetails,
    factorio_version: Option<String>,
) -> Result<InstalledModDetails, String> {
    Ok(
        check_single_mod_update_with_client(&api_client, installed_mod, factorio_version).await,
    )
}

#[tauri::command]
pub async fn check_mod_updates(
    installed_mods: Vec<InstalledModDetails>,
    factorio_version: Option<String>,
) -> Result<Vec<InstalledModDetails>, String> {
    Ok(check_updates_for_installed_mods(installed_mods, factorio_version).await)
}

#[tauri::command]
pub async fn delete_installed_mod(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    delete_mod_file(&path)
}
