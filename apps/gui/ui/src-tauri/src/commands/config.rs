use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn default_factorio_version() -> String {
    "2.1".to_string()
}

fn default_theme_mode() -> String {
    "system".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub mods_folder: Option<String>,
    #[serde(default = "default_factorio_version")]
    pub factorio_version: String,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mods_folder: None,
            factorio_version: default_factorio_version(),
            theme_mode: default_theme_mode(),
        }
    }
}

fn get_config_file_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "Could not determine system config directory".to_string())?;
    
    let app_dir = config_dir.join("factorio-mod-downloader");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(app_dir.join("config.json"))
}

#[tauri::command]
pub fn get_mods_folder() -> Result<Option<String>, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();
    Ok(config.mods_folder)
}

#[tauri::command]
pub fn save_mods_folder(path: String) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    let mut config: AppConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    };
    config.mods_folder = Some(path);
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_factorio_version() -> Result<String, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(default_factorio_version());
    }
    
    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();
    Ok(config.factorio_version)
}

#[tauri::command]
pub fn save_factorio_version(version: String) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    let mut config: AppConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    };
    
    config.factorio_version = version;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_theme_mode() -> Result<String, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(default_theme_mode());
    }

    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();
    Ok(config.theme_mode)
}

#[tauri::command]
pub fn save_theme_mode(theme_mode: String) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    let mut config: AppConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    };

    config.theme_mode = theme_mode;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn detect_default_mods_folder() -> Result<String, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    
    #[cfg(target_os = "macos")]
    let default_path = home.join("Library/Application Support/factorio/mods");

    #[cfg(target_os = "windows")]
    let default_path = dirs::data_dir()
        .map(|d| d.join("Factorio/mods"))
        .unwrap_or_else(|| home.join("AppData/Roaming/Factorio/mods"));

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let default_path = home.join(".factorio/mods");

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
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        let _ = std::fs::create_dir_all(&path_buf);
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
        std::process::Command::new("explorer")
            .arg(&path)
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
