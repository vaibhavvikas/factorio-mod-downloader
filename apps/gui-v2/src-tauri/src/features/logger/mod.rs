pub use common::AppLogPayload;

/// Tauri Command: Allow frontend or plugins to route logs through backend event stream
#[tauri::command]
pub fn log_message(level: String, tag: Option<String>, message: String) {
    let t = tag.unwrap_or_else(|| level.clone());
    common::emit_log_with_tag(&level, &t, &message);
}
