pub mod features;

use features::config::{
    detect_default_mods_folder, get_app_config, get_factorio_version, get_mods_folder,
    open_folder_in_explorer, pick_mods_folder_dialog, save_app_config, save_factorio_version,
    save_mods_folder,
};
use features::downloader::{
    cancel_all_download_tasks, cancel_download_task, clear_completed_download_tasks,
    get_download_tasks, pause_download_task, resume_download_task, retry_download_task,
    start_download_batch, toggle_pause_download_task, DownloaderState,
};
use features::explore::browse_mods;
use features::logger::log_message;
use features::queue::{fetch_mod_details, resolve_download_batch};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{Emitter, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(factorio::client::ApiClient::new())
        .manage(DownloaderState::new())
        .invoke_handler(tauri::generate_handler![
            browse_mods,
            fetch_mod_details,
            resolve_download_batch,
            log_message,
            start_download_batch,
            get_download_tasks,
            pause_download_task,
            resume_download_task,
            toggle_pause_download_task,
            cancel_download_task,
            cancel_all_download_tasks,
            retry_download_task,
            clear_completed_download_tasks,
            get_app_config,
            save_app_config,
            get_mods_folder,
            save_mods_folder,
            detect_default_mods_folder,
            pick_mods_folder_dialog,
            open_folder_in_explorer,
            get_factorio_version,
            save_factorio_version,
        ])
        .setup(|app| {
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Factorio Mod Downloader")
                .inner_size(1280.0, 720.0)
                .min_inner_size(800.0, 600.0);

            // set transparent title bar and hidden title only when building for macOS
            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .title_bar_style(TitleBarStyle::Transparent)
                .hidden_title(true);

            let window = win_builder.build().unwrap();

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
