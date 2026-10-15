pub mod features;

use features::downloader::{
    cancel_all_download_tasks, cancel_download_task, clear_completed_download_tasks,
    get_download_tasks, retry_download_task, start_download_batch, DownloaderState,
};
use features::explore::browse_mods;
use features::logger::log_message;
use tauri::{Emitter, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(factorio::client::ApiClient::new())
        .manage(DownloaderState::new())
        .invoke_handler(tauri::generate_handler![
            browse_mods,
            log_message,
            start_download_batch,
            get_download_tasks,
            cancel_download_task,
            cancel_all_download_tasks,
            retry_download_task,
            clear_completed_download_tasks,
        ])
        .setup(|app| {
            let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Factorio Mod Downloader")
                .inner_size(1280.0, 720.0)
                .min_inner_size(800.0, 600.0);

            // set transparent title bar only when building for macOS
            #[cfg(target_os = "macos")]
            let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

            let window = win_builder.build().unwrap();

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
