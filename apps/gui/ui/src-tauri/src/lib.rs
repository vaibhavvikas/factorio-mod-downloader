pub mod commands;

use commands::mod_resolver::{fetch_mod_details, resolve_download_batch};
use commands::config::{get_mods_folder, save_mods_folder, detect_default_mods_folder, pick_mods_folder_dialog};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_mod_details,
            resolve_download_batch,
            get_mods_folder,
            save_mods_folder,
            detect_default_mods_folder,
            pick_mods_folder_dialog
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
