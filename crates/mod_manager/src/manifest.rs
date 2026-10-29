use crate::models::{InstalledManifest, ManifestModEntry};
use std::fs;
use std::path::Path;

pub fn manifest_path(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join("installed-manifest.json")
}

pub fn load_manifest(app_data_dir: &Path) -> InstalledManifest {
    let path = manifest_path(app_data_dir);
    if !path.is_file() {
        return InstalledManifest::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

pub fn save_manifest(app_data_dir: &Path, manifest: &InstalledManifest) -> Result<(), std::io::Error> {
    let _ = fs::create_dir_all(app_data_dir);
    let path = manifest_path(app_data_dir);
    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn record_mod_installed(
    app_data_dir: &Path,
    name: &str,
    version: Option<String>,
) -> Result<(), std::io::Error> {
    let mut manifest = load_manifest(app_data_dir);
    let entry = manifest.mods.entry(name.to_string()).or_insert_with(|| ManifestModEntry {
        installed_at: Some(chrono::Utc::now().to_rfc3339()),
        pinned: false,
        pinned_policy: None,
        pinned_by_profile_id: None,
        active_version: version.clone(),
    });

    if entry.installed_at.is_none() {
        entry.installed_at = Some(chrono::Utc::now().to_rfc3339());
    }
    if let Some(v) = version {
        entry.active_version = Some(v);
    }

    save_manifest(app_data_dir, &manifest)
}
