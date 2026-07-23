pub mod commands;

use commands::config::{
    detect_default_mods_folder, get_factorio_version, get_mods_folder, get_theme_mode,
    open_folder_in_explorer, pick_mods_folder_dialog, save_factorio_version, save_mods_folder,
    save_theme_mode,
};
use commands::mod_downloader::{
    clear_completed_download_tasks, get_download_tasks, retry_download_task, start_download_batch,
    DownloaderState,
};
use commands::mod_resolver::{browse_mods, fetch_mod_details, resolve_download_batch, search_mods};
use factorio::client::ApiClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ApiClient::new())
        .manage(DownloaderState::new())
        .invoke_handler(tauri::generate_handler![
            search_mods,
            browse_mods,
            fetch_mod_details,
            resolve_download_batch,
            get_mods_folder,
            save_mods_folder,
            detect_default_mods_folder,
            pick_mods_folder_dialog,
            open_folder_in_explorer,
            get_factorio_version,
            save_factorio_version,
            get_theme_mode,
            save_theme_mode,
            start_download_batch,
            get_download_tasks,
            clear_completed_download_tasks,
            retry_download_task,
            commands::installed_mods::get_installed_mods_info,
            commands::installed_mods::check_mod_updates,
            commands::installed_mods::delete_installed_mod
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
