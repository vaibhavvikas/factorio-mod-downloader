pub mod features;

use features::config::{
    detect_default_mods_folder, get_app_config, get_config_path, get_factorio_version,
    get_mods_folder, open_config_folder, open_folder_in_explorer, pick_mods_folder_dialog,
    reset_app_config, save_app_config, save_factorio_version, save_mods_folder, save_window_state,
};
use features::downloader::{
    cancel_all_download_tasks, cancel_download_batch, cancel_download_task, clear_completed_download_tasks,
    get_download_batches, get_download_tasks, pause_download_batch, pause_download_task,
    remove_download_task, resume_download_batch, resume_download_task, retry_download_batch, retry_download_task,
    start_download_batch, toggle_pause_download_task, DownloaderState,
};
use features::explore::browse_mods;
use features::logger::log_message;
use features::collections::{
    apply_collection, delete_collection, export_collection_dialog, export_collection_json,
    get_collections, import_collection_dialog, import_collection_from_json, save_collection,
};
use features::mod_manager::{
    check_mod_updates, delete_mod_version, get_installed_mod_groups, get_installed_mod_groups_graph,
    get_mod_storage_usage, is_factorio_running, register_and_enable_mod_group,
    set_active_mod_version, set_mods_enabled_batch, toggle_mod_enabled, uninstall_mods, uninstall_mods_preview,
};
use features::queue::{fetch_mod_details, resolve_download_batch};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_window_state::{StateFlags, WindowExt};

mod window_cmds {
    #[tauri::command]
    pub fn show_main_window(window: tauri::WebviewWindow) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
use window_cmds::show_main_window;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .manage(factorio::client::ApiClient::new())
        .manage(DownloaderState::new())
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            browse_mods,
            fetch_mod_details,
            resolve_download_batch,
            log_message,
            start_download_batch,
            get_download_tasks,
            get_download_batches,
            pause_download_task,
            resume_download_task,
            toggle_pause_download_task,
            cancel_download_task,
            cancel_all_download_tasks,
            retry_download_task,
            remove_download_task,
            clear_completed_download_tasks,
            pause_download_batch,
            resume_download_batch,
            cancel_download_batch,
            retry_download_batch,
            get_app_config,
            save_app_config,
            get_mods_folder,
            save_mods_folder,
            detect_default_mods_folder,
            pick_mods_folder_dialog,
            open_folder_in_explorer,
            get_factorio_version,
            save_factorio_version,
            get_config_path,
            open_config_folder,
            reset_app_config,
            save_window_state,
            get_installed_mod_groups,
            get_installed_mod_groups_graph,
            register_and_enable_mod_group,
            toggle_mod_enabled,
            set_mods_enabled_batch,
            set_active_mod_version,
            delete_mod_version,
            uninstall_mods_preview,
            uninstall_mods,
            get_mod_storage_usage,
            check_mod_updates,
            is_factorio_running,
            get_collections,
            save_collection,
            delete_collection,
            apply_collection,
            export_collection_json,
            export_collection_dialog,
            import_collection_from_json,
            import_collection_dialog,
        ])
        .setup(|app| {
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Factorio Mod Downloader")
                .background_color(tauri::window::Color(24, 24, 27, 255))
                .inner_size(1280.0, 720.0)
                .min_inner_size(800.0, 600.0)
                .visible(false);

            // set transparent title bar and hidden title only when building for macOS
            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .title_bar_style(TitleBarStyle::Transparent)
                .hidden_title(true);

            let window = win_builder.build().unwrap();

            // Restore previous window position, size, and maximized state using tauri-plugin-window-state
            let _ = window.restore_state(StateFlags::all() & !StateFlags::VISIBLE);

            let window_fallback = window.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
                let _ = window_fallback.show();
            });

            // Set native title bar theming on Windows (DWM dark mode & matching background)
            #[cfg(target_os = "windows")]
            {
                use windows_sys::Win32::Graphics::Dwm::{
                    DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
                    DWMWA_USE_IMMERSIVE_DARK_MODE,
                };

                if let Ok(hwnd) = window.hwnd() {
                    let hwnd = hwnd.0 as _;
                    unsafe {
                        // Enable Windows 11 immersive dark mode (dark min/max/close controls)
                        let dark_mode: i32 = 1;
                        let _ = DwmSetWindowAttribute(
                            hwnd,
                            DWMWA_USE_IMMERSIVE_DARK_MODE as u32,
                            &dark_mode as *const _ as _,
                            std::mem::size_of::<i32>() as u32,
                        );

                        // Set caption bar color to match app dark background #18181b (COLORREF 0x001B1818)
                        let caption_color: u32 = 0x001B1818;
                        let _ = DwmSetWindowAttribute(
                            hwnd,
                            DWMWA_CAPTION_COLOR as u32,
                            &caption_color as *const _ as _,
                            std::mem::size_of::<u32>() as u32,
                        );

                        // Set caption text color to clean white/zinc #f4f4f5 (COLORREF 0x00F5F4F4)
                        let text_color: u32 = 0x00F5F4F4;
                        let _ = DwmSetWindowAttribute(
                            hwnd,
                            DWMWA_TEXT_COLOR as u32,
                            &text_color as *const _ as _,
                            std::mem::size_of::<u32>() as u32,
                        );
                    }
                }
            }

            // set background color only when building for macOS
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSColor, NSWindow};

                let ns_window_ptr = window.ns_window().unwrap() as *mut NSWindow;
                let ns_window = unsafe { &*ns_window_ptr };
                let bg_color = NSColor::colorWithRed_green_blue_alpha(
                    24.0 / 255.0,
                    24.0 / 255.0,
                    27.0 / 255.0,
                    1.0,
                );
                ns_window.setBackgroundColor(Some(&bg_color));
            }

            // Bridge common event bus to Tauri frontend webview
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut rx = common::subscribe();
                while let Ok(payload) = rx.recv().await {
                    let _ = app_handle.emit("app:log", payload);
                }
            });

            // Emit initial system boot telemetry to the event bus
            tauri::async_runtime::spawn(async move {
                // Short yield so frontend webview attaches listeners
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                common::emit_log_with_tag("system", "system", "Factorio Mod Downloader backend initialized.");
                common::emit_log_with_tag("system", "queue", "Downloader queue engine active (concurrency: 5).");
                common::emit_log_with_tag("system", "portal", "Mod Portal API client connected. Mirror ready.");
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
