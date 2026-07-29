use factorio::installed::{
    check_updates_for_installed_mods, delete_mod_file, scan_installed_mods, InstalledModDetails,
};
use std::path::PathBuf;

#[tauri::command]
pub async fn get_installed_mods_info(mods_folder: String) -> Result<Vec<InstalledModDetails>, String> {
    let folder_path = PathBuf::from(&mods_folder);
    Ok(scan_installed_mods(&folder_path))
}

#[tauri::command]
pub async fn check_mod_updates(
    installed_mods: Vec<InstalledModDetails>,
) -> Result<Vec<InstalledModDetails>, String> {
    Ok(check_updates_for_installed_mods(installed_mods).await)
}

#[tauri::command]
pub async fn delete_installed_mod(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    delete_mod_file(&path)
}
