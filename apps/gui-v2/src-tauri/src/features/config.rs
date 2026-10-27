use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub mods_folder: Option<String>,
    pub factorio_version: Option<String>,
    pub theme_mode: Option<String>,
    pub max_concurrency: Option<usize>,
    pub auto_retry: Option<bool>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mods_folder: None,
            factorio_version: Some("2.0".to_string()),
            theme_mode: Some("system".to_string()),
            max_concurrency: Some(5),
            auto_retry: Some(true),
        }
    }
}

fn get_config_dir() -> Result<PathBuf, String> {
    let data_dir = dirs::config_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "Could not determine system configuration directory".to_string())?;
    let app_dir = data_dir.join("factorio-mod-downloader");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir)
}

fn get_config_file_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("config.json"))
}

#[tauri::command]
pub fn get_app_config() -> Result<AppConfig, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&content).unwrap_or_default())
}

#[tauri::command]
pub fn save_app_config(config: AppConfig) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_mods_folder() -> Result<Option<String>, String> {
    let config = get_app_config()?;
    if let Some(ref path) = config.mods_folder {
        let p = Path::new(path);
        if path.trim().is_empty() || !p.exists() || !p.is_dir() {
            return Ok(None);
        }
    }
    Ok(config.mods_folder)
}

#[tauri::command]
pub fn save_mods_folder(path: String) -> Result<(), String> {
    let mut config = get_app_config().unwrap_or_default();
    #[cfg(target_os = "windows")]
    let normalized = path.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let normalized = path;

    config.mods_folder = Some(normalized);
    save_app_config(config)
}

#[tauri::command]
pub fn detect_default_mods_folder() -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

    #[cfg(target_os = "macos")]
    let default_path = home
        .join("Library")
        .join("Application Support")
        .join("factorio")
        .join("mods");

    #[cfg(target_os = "windows")]
    let default_path = dirs::data_dir()
        .map(|d| d.join("Factorio").join("mods"))
        .unwrap_or_else(|| home.join("AppData").join("Roaming").join("Factorio").join("mods"));

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let default_path = home.join(".factorio").join("mods");

    Ok(default_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn pick_mods_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Factorio Mods Directory")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_folder_in_explorer(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        let _ = fs::create_dir_all(&path_buf);
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        let win_path = path.replace('/', "\\");
        std::process::Command::new("explorer")
            .arg(&win_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_factorio_version() -> Result<String, String> {
    let config = get_app_config()?;
    Ok(config.factorio_version.unwrap_or_else(|| "2.1".to_string()))
}

#[tauri::command]
pub fn save_factorio_version(version: String) -> Result<(), String> {
    let mut config = get_app_config().unwrap_or_default();
    config.factorio_version = Some(version);
    save_app_config(config)
}
