use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::pin::Pin;
use std::future::Future;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ModInfo {
    pub name: String,
    pub title: String,
    pub summary: String,
    pub downloads_count: u64,
    pub owner: String,
    pub releases: Vec<Release>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Release {
    pub version: String,
    pub download_url: String,
    pub file_name: String,
    pub released_at: String,
    pub sha1: String,
    pub info_json: InfoJson,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct InfoJson {
    pub factorio_version: String,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Dependency {
    pub name: String,
    pub optional: bool,
}

#[derive(Debug, Clone)]
pub struct DownloadPlan {
    pub mod_name: String,
    pub version: String,
    pub file_name: String,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub target_factorio_version: String,
    pub target_mod_version: Option<String>,
    pub install_optional_deps: bool,
    pub install_optional_all_deps: bool,
    pub max_depth: usize,
}

#[derive(Debug, Clone)]
pub struct DownloadStats {
    pub installed: Vec<(String, String)>,
    pub failed: Vec<(String, String)>,
}

// Shared utility functions
pub fn extract_mod_id(input: &str) -> Result<String, Box<dyn std::error::Error>> {
    let input = input.trim();
    
    // Handle ModID formats: modID, modID@version, modID@latest
    if !input.contains("://") {
        // Direct mod ID format
        let mod_id = input.split('@').next().unwrap_or(input);
        if !mod_id.is_empty() {
            return Ok(mod_id.to_string());
        }
    }
    
    // Handle URL formats
    let url_parts: Vec<&str> = input.split('/').collect();
    if let Some(mod_part) = url_parts.iter().find(|&&part| part.starts_with("mod")) {
        if let Some(mod_id) = mod_part.strip_prefix("mod/") {
            return Ok(mod_id.split('?').next().unwrap_or(mod_id).to_string());
        }
    }
    
    // Fallback: try to extract from the last part of the URL
    if let Some(last_part) = url_parts.last() {
        let mod_id = last_part.split('?').next().unwrap_or(last_part);
        if !mod_id.is_empty() {
            return Ok(mod_id.to_string());
        }
    }
    
    Err("Could not extract mod ID from input".into())
}

pub fn extract_version_spec(input: &str) -> Option<String> {
    if !input.contains("://") && input.contains('@') {
        let parts: Vec<&str> = input.split('@').collect();
        if parts.len() == 2 {
            return Some(parts[1].to_string());
        }
    }
    None
}

pub async fn get_mod_info(mod_id: &str) -> Result<ModInfo, Box<dyn std::error::Error>> {
    let api_url = format!("https://re146.dev/factorio/mods/modinfo?id={}", mod_id);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    
    let response = client.get(&api_url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }
    
    let mod_info: ModInfo = response.json().await?;
    Ok(mod_info)
}

pub async fn download_mod(
    mod_name: &str,
    version: &str,
    file_name: &str,
    output_path: &str,
) -> Result<u64, Box<dyn std::error::Error>> {
    let download_url = format!("https://mods-storage.re146.dev/{}/{}.zip", mod_name, version);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(120))
        .build()?;
    
    let response = client.get(&download_url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()).into());
    }
    
    let content_length = response.content_length().unwrap_or(0);
    let bytes = response.bytes().await?;
    
    // Create output directory if it doesn't exist
    std::fs::create_dir_all(output_path)?;
    
    // Write file
    let file_path = std::path::Path::new(output_path).join(file_name);
    std::fs::write(&file_path, &bytes)?;
    
    Ok(content_length)
}

pub fn is_base_dependency(mod_name: &str) -> bool {
    matches!(mod_name, "base" | "core" | "freeplay" | "elevated-rails" | "quality" | "space-age")
}

pub fn parse_dependencies(deps: &[String]) -> Vec<Dependency> {
    deps.iter()
        .filter_map(|dep| {
            let dep = dep.trim();
            if dep.is_empty() || dep == "base" {
                return None;
            }
            
            let optional = dep.starts_with('?');
            let name = if optional {
                dep.trim_start_matches('?').trim()
            } else {
                dep
            };
            
            // Remove version constraints
            let name = name.split_whitespace().next().unwrap_or(name);
            let name = name.split(">=").next().unwrap_or(name);
            let name = name.split("<=").next().unwrap_or(name);
            let name = name.split("=").next().unwrap_or(name);
            let name = name.split(">").next().unwrap_or(name);
            let name = name.split("<").next().unwrap_or(name);
            
            if name.is_empty() || is_base_dependency(name) {
                return None;
            }
            
            Some(Dependency {
                name: name.to_string(),
                optional,
            })
        })
        .collect()
}

pub fn find_compatible_release<'a>(
    mod_info: &'a ModInfo,
    config: &Config,
    is_main_mod: bool,
) -> Result<&'a Release, Box<dyn std::error::Error>> {
    // If specific version requested for main mod
    if is_main_mod {
        if let Some(target_version) = &config.target_mod_version {
            if let Some(release) = mod_info.releases.iter().find(|r| r.version == *target_version) {
                return Ok(release);
            }
            return Err(format!("Version {} not found for mod {}", target_version, mod_info.name).into());
        }
    }
    
    // Find latest compatible release (get LAST compatible version, not first)
    let compatible_releases: Vec<&Release> = mod_info.releases
        .iter()
        .filter(|r| is_version_compatible(&r.info_json.factorio_version, &config.target_factorio_version))
        .collect();
    
    if let Some(latest_release) = compatible_releases.last() {
        return Ok(latest_release);
    }
    
    Err(format!("No compatible release found for mod {} (Factorio {})", mod_info.name, config.target_factorio_version).into())
}

pub fn is_version_compatible(mod_version: &str, target_version: &str) -> bool {
    // Simple version compatibility check
    // This is a simplified version - you might want to implement proper semver comparison
    let mod_major = mod_version.split('.').next().unwrap_or("0");
    let target_major = target_version.split('.').next().unwrap_or("0");
    
    mod_major == target_major
}

pub fn resolve_dependencies<'a>(
    mod_id: &'a str,
    config: &'a Config,
    visited: &'a mut HashSet<String>,
    depth: usize,
    parent_is_optional: bool,
) -> Pin<Box<dyn Future<Output = Result<Vec<DownloadPlan>, Box<dyn std::error::Error>>> + 'a>> {
    Box::pin(async move {
        if depth > config.max_depth {
            return Ok(vec![]);
        }
        
        if visited.contains(mod_id) {
            return Ok(vec![]);
        }
        visited.insert(mod_id.to_string());
        
        if is_base_dependency(mod_id) {
            return Ok(vec![]);
        }
        
        let mod_info = match get_mod_info(mod_id).await {
            Ok(info) => info,
            Err(_) => return Ok(vec![]),
        };
        
        let release = match find_compatible_release(&mod_info, config, depth == 0) {
            Ok(r) => r,
            Err(_) => return Ok(vec![]),
        };
        
        let dependencies = parse_dependencies(&release.info_json.dependencies);
        
        let mut plan = vec![DownloadPlan {
            mod_name: mod_info.name.clone(),
            version: release.version.clone(),
            file_name: release.file_name.clone(),
        }];
        
        for dep in dependencies {
            if is_base_dependency(&dep.name) {
                continue;
            }
            
            let should_install = if dep.optional {
                if depth == 0 {
                    config.install_optional_deps
                } else if parent_is_optional {
                    config.install_optional_all_deps
                } else {
                    config.install_optional_all_deps
                }
            } else {
                true
            };
            
            if should_install {
                let dep_plan = resolve_dependencies(
                    &dep.name,
                    config,
                    visited,
                    depth + 1,
                    dep.optional,
                ).await?;
                
                plan.extend(dep_plan);
            }
        }
        
        Ok(plan)
    })
}
