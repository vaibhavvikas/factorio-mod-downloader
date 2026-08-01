use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const VALID_FACTORIO_VERSIONS: &[&str] = &[
    "2.1", "2.0", "1.1", "1.0", "0.18", "0.17", "0.16", "0.15", "0.14", "0.13", "any",
];

fn default_factorio_version() -> String {
    "2.1".to_string()
}

fn default_theme_mode() -> String {
    "system".to_string()
}

fn default_window_width() -> u32 {
    1280
}

fn default_window_height() -> u32 {
    720
}

const MIN_WINDOW_WIDTH: u32 = 400;
const MIN_WINDOW_HEIGHT: u32 = 300;
const MAX_WINDOW_WIDTH: u32 = 7680;
const MAX_WINDOW_HEIGHT: u32 = 4320;

fn clamp_window_width(width: u32) -> u32 {
    if width < MIN_WINDOW_WIDTH || width > MAX_WINDOW_WIDTH {
        default_window_width()
    } else {
        width
    }
}

fn clamp_window_height(height: u32) -> u32 {
    if height < MIN_WINDOW_HEIGHT || height > MAX_WINDOW_HEIGHT {
        default_window_height()
    } else {
        height
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub mods_folder: Option<String>,
    #[serde(default = "default_factorio_version")]
    pub factorio_version: String,
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(default = "default_window_width")]
    pub window_width: u32,
    #[serde(default = "default_window_height")]
    pub window_height: u32,
    #[serde(default)]
    pub window_maximized: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mods_folder: None,
            factorio_version: default_factorio_version(),
            theme_mode: default_theme_mode(),
            window_width: default_window_width(),
            window_height: default_window_height(),
            window_maximized: false,
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
    if let Some(ref path) = config.mods_folder {
        let p = std::path::Path::new(path);
        if path.trim().is_empty() || !p.exists() || !p.is_dir() {
            return Ok(None);
        }
    }
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FactorioVersionOption {
    pub value: String,
    pub label: String,
    #[serde(rename = "shortLabel")]
    pub short_label: String,
}

#[tauri::command]
pub fn get_valid_factorio_versions() -> Vec<FactorioVersionOption> {
    VALID_FACTORIO_VERSIONS
        .iter()
        .map(|&ver| {
            let label = if ver == "any" {
                "Any Version".to_string()
            } else {
                format!("Factorio {}", ver)
            };
            let short_label = if ver == "any" {
                "Any".to_string()
            } else {
                ver.to_string()
            };
            FactorioVersionOption {
                value: ver.to_string(),
                label,
                short_label,
            }
        })
        .collect()
}

#[tauri::command]
pub fn get_factorio_version() -> Result<String, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(default_factorio_version());
    }
    
    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();
    if !VALID_FACTORIO_VERSIONS.contains(&config.factorio_version.as_str()) {
        return Ok(default_factorio_version());
    }
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
    
    let validated_version = if VALID_FACTORIO_VERSIONS.contains(&version.as_str()) {
        version
    } else {
        default_factorio_version()
    };

    config.factorio_version = validated_version;
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

#[tauri::command]
pub fn open_config_folder() -> Result<(), String> {
    let config_file = get_config_file_path()?;
    let config_dir = config_file.parent().ok_or_else(|| "Could not determine parent config directory".to_string())?;
    open_folder_in_explorer(config_dir.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[tauri::command]
pub fn get_window_state() -> Result<WindowState, String> {
    let config_path = get_config_file_path()?;
    if !config_path.exists() {
        return Ok(WindowState {
            width: default_window_width(),
            height: default_window_height(),
            maximized: false,
        });
    }

    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();
    Ok(WindowState {
        width: clamp_window_width(config.window_width),
        height: clamp_window_height(config.window_height),
        maximized: config.window_maximized,
    })
}

#[tauri::command]
pub fn save_window_state(width: u32, height: u32, maximized: bool) -> Result<(), String> {
    let config_path = get_config_file_path()?;
    let mut config: AppConfig = if config_path.exists() {
        let content = fs::read_to_string(&config_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    };

    config.window_width = clamp_window_width(width);
    config.window_height = clamp_window_height(height);
    config.window_maximized = maximized;
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_factorio_versions() {
        assert!(VALID_FACTORIO_VERSIONS.contains(&"2.1"));
        assert!(VALID_FACTORIO_VERSIONS.contains(&"2.0"));
        assert!(VALID_FACTORIO_VERSIONS.contains(&"any"));
        assert!(!VALID_FACTORIO_VERSIONS.contains(&"all"));
        assert!(!VALID_FACTORIO_VERSIONS.contains(&"invalid_ver"));
    }

    #[test]
    fn test_default_config_values() {
        let config = AppConfig::default();
        assert_eq!(config.factorio_version, "2.1");
        assert_eq!(config.mods_folder, None);
    }
}
