pub mod commands;

use commands::config::{
    detect_default_mods_folder, get_factorio_version, get_mods_folder, get_theme_mode,
    get_window_state, open_folder_in_explorer, pick_mods_folder_dialog, save_factorio_version,
    save_mods_folder, save_theme_mode, save_window_state,
};
use commands::mod_downloader::{
    clear_completed_download_tasks, get_download_tasks, retry_download_task, start_download_batch,
    DownloaderState,
};
use commands::mod_resolver::{browse_mods, fetch_mod_details, resolve_download_batch, search_mods};
use factorio::client::ApiClient;
use tauri::Manager;

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
            get_download_tasks,
            start_download_batch,
            clear_completed_download_tasks,
            retry_download_task,
            get_mods_folder,
            save_mods_folder,
            detect_default_mods_folder,
            pick_mods_folder_dialog,
            open_folder_in_explorer,
            get_factorio_version,
            save_factorio_version,
            get_theme_mode,
            save_theme_mode,
            get_window_state,
            save_window_state,
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

            let window = app.get_webview_window("main").ok_or("main window not found")?;
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(1280.0, 720.0))));
            let window_clone = window.clone();
            let event_window = window_clone.clone();

            tauri::async_runtime::spawn(async move {
                match get_window_state() {
                    Ok(state) => {
                        let width = state.width.max(1280);
                        let height = state.height.max(720);
                        let _ = window_clone.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(
                            width,
                            height,
                        )));
                        if state.maximized {
                            let _ = window_clone.maximize();
                        }
                    }
                    Err(_) => {}
                }

                let window_for_events = event_window.clone();
                let _ = event_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(size) = event {
                        let maximized = window_for_events.is_maximized().unwrap_or(false);
                        let width = (size.width as u32).max(1280);
                        let height = (size.height as u32).max(720);
                        let _ = save_window_state(width, height, maximized);
                    }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
