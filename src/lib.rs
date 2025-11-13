use pyo3::prelude::*;
use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::File;
use std::io::Write;
use std::pin::Pin;
use std::future::Future;
use std::path::Path;

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ModInfo {
    name: String,
    title: String,
    summary: String,
    downloads_count: u64,
    owner: String,
    releases: Vec<Release>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Release {
    version: String,
    download_url: String,
    file_name: String,
    released_at: String,
    sha1: String,
    info_json: InfoJson,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct InfoJson {
    factorio_version: String,
    dependencies: Vec<String>,
}

#[derive(Debug, Clone)]
struct Dependency {
    name: String,
    optional: bool,
}

#[derive(Debug, Clone)]
struct DownloadPlan {
    mod_name: String,
    version: String,
    file_name: String,
}

struct Config {
    target_factorio_version: String,
    target_mod_version: Option<String>,
    install_optional_deps: bool,
    install_optional_all_deps: bool,
    max_depth: usize,
}

#[pyclass]
#[derive(Clone)]
struct DownloadResult {
    #[pyo3(get)]
    success: bool,
    #[pyo3(get)]
    downloaded_mods: Vec<String>,
    #[pyo3(get)]
    failed_mods: Vec<(String, String)>,
    #[pyo3(get)]
    total_size: u64,
    #[pyo3(get)]
    duration: f64,
}

#[pymethods]
impl DownloadResult {
    fn __repr__(&self) -> String {
        format!(
            "DownloadResult(success={}, downloaded={}, failed={}, size={} MB, duration={:.2}s)",
            self.success,
            self.downloaded_mods.len(),
            self.failed_mods.len(),
            self.total_size / 1024 / 1024,
            self.duration
        )
    }
}

fn resolve_dependencies<'a>(
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
            
            if !should_install {
                continue;
            }
            
            match resolve_dependencies(
                &dep.name,
                config,
                visited,
                depth + 1,
                dep.optional || parent_is_optional,
            ).await {
                Ok(mut dep_plans) => {
                    plan.append(&mut dep_plans);
                }
                Err(_) => {}
            }
        }
        
        Ok(plan)
    })
}

fn find_compatible_release(
    mod_info: &ModInfo,
    config: &Config,
    is_main_mod: bool,
) -> Result<Release, Box<dyn std::error::Error>> {
    if is_main_mod {
        if let Some(target_version) = &config.target_mod_version {
            if let Some(release) = mod_info.releases.iter().find(|r| &r.version == target_version) {
                return Ok(release.clone());
            }
            return Err(format!("Version {} not found", target_version).into());
        }
    }
    
    let compatible: Vec<&Release> = mod_info.releases
        .iter()
        .filter(|r| is_factorio_version_compatible(
            &r.info_json.factorio_version,
            &config.target_factorio_version
        ))
        .collect();
    
    if let Some(latest) = compatible.last() {
        Ok((*latest).clone())
    } else {
        mod_info.releases
            .last()
            .cloned()
            .ok_or_else(|| "No releases found".into())
    }
}

fn parse_dependencies(deps: &[String]) -> Vec<Dependency> {
    let mut result = Vec::new();
    
    for dep_str in deps {
        let dep_str = dep_str.trim();
        
        if dep_str.is_empty() {
            continue;
        }
        
        let mut optional = false;
        let mut incompatible = false;
        let mut dep_name = dep_str;
        
        if dep_name.starts_with('?') {
            optional = true;
            dep_name = &dep_name[1..].trim();
        }
        if dep_name.starts_with('!') {
            incompatible = true;
            dep_name = &dep_name[1..].trim();
        }
        if dep_name.starts_with('~') {
            dep_name = &dep_name[1..].trim();
        }
        if dep_name.starts_with("(?)") {
            optional = true;
            dep_name = &dep_name[3..].trim();
        }
        
        if incompatible {
            continue;
        }
        
        let parts: Vec<&str> = dep_name.split_whitespace().collect();
        let name = parts[0].to_string();
        
        result.push(Dependency {
            name,
            optional,
        });
    }
    
    result
}

fn is_base_dependency(name: &str) -> bool {
    matches!(
        name,
        "base" | "core" | "space-age" | "elevated-rails" | "quality"
    )
}

fn is_factorio_version_compatible(release_version: &str, target_version: &str) -> bool {
    let release_parts: Vec<&str> = release_version.split('.').collect();
    let target_parts: Vec<&str> = target_version.split('.').collect();
    
    if release_parts.is_empty() || target_parts.is_empty() {
        return false;
    }
    
    if release_parts[0] != target_parts[0] {
        return false;
    }
    
    if target_parts.len() == 1 {
        return true;
    }
    
    release_parts.len() >= 2 && release_parts[1] == target_parts[1]
}

async fn get_mod_info(mod_id: &str) -> Result<ModInfo, Box<dyn std::error::Error>> {
    let api_url = format!("https://re146.dev/factorio/mods/modinfo?id={}", mod_id);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    
    let response = client.get(&api_url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }
    
    let mod_info: ModInfo = response.json().await?;
    Ok(mod_info)
}

async fn download_mod(
    mod_name: &str,
    version: &str,
    file_name: &str,
    output_path: &str,
) -> Result<u64, Box<dyn std::error::Error>> {
    let download_url = format!("https://mods-storage.re146.dev/{}/{}.zip", mod_name, version);
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(120))
        .build()?;
    
    let response = client.get(&download_url).send().await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()).into());
    }
    
    let bytes = response.bytes().await?;
    let size = bytes.len() as u64;
    
    let file_path = Path::new(output_path).join(file_name);
    let mut file = File::create(file_path)?;
    file.write_all(&bytes)?;
    
    Ok(size)
}

fn extract_mod_id(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    let url = url.trim_end_matches('/');
    
    if let Some(mod_part) = url.split("/mod/").nth(1) {
        let mod_id = mod_part.split('?').next().unwrap_or(mod_part);
        if mod_id.is_empty() {
            return Err("Mod ID is empty".into());
        }
        Ok(mod_id.to_string())
    } else {
        Err("Invalid URL".into())
    }
}

/// Download a single mod with dependencies
#[pyfunction]
#[pyo3(signature = (mod_url, output_path, factorio_version="2.0", include_optional=true, include_optional_all=false, target_mod_version=None, max_depth=10))]
fn download_mod_with_deps(
    mod_url: String,
    output_path: String,
    factorio_version: &str,
    include_optional: bool,
    include_optional_all: bool,
    target_mod_version: Option<String>,
    max_depth: usize,
) -> PyResult<DownloadResult> {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    
    runtime.block_on(async {
        let start_time = std::time::Instant::now();
        
        // Extract mod ID
        let mod_id = match extract_mod_id(&mod_url) {
            Ok(id) => id,
            Err(e) => {
                return Ok(DownloadResult {
                    success: false,
                    downloaded_mods: vec![],
                    failed_mods: vec![(mod_url.clone(), e.to_string())],
                    total_size: 0,
                    duration: start_time.elapsed().as_secs_f64(),
                });
            }
        };
        
        let config = Config {
            target_factorio_version: factorio_version.to_string(),
            target_mod_version,
            install_optional_deps: include_optional,
            install_optional_all_deps: include_optional_all,
            max_depth,
        };
        
        let mut visited = HashSet::new();
        
        // Resolve dependencies
        let download_plan = match resolve_dependencies(
            &mod_id,
            &config,
            &mut visited,
            0,
            false,
        ).await {
            Ok(plan) => plan,
            Err(e) => {
                return Ok(DownloadResult {
                    success: false,
                    downloaded_mods: vec![],
                    failed_mods: vec![(mod_id, e.to_string())],
                    total_size: 0,
                    duration: start_time.elapsed().as_secs_f64(),
                });
            }
        };
        
        // Remove duplicates
        let mut unique_plan: Vec<DownloadPlan> = Vec::new();
        let mut seen_mods: HashSet<String> = HashSet::new();
        
        for plan in download_plan {
            if !seen_mods.contains(&plan.mod_name) {
                seen_mods.insert(plan.mod_name.clone());
                unique_plan.push(plan);
            }
        }
        
        if unique_plan.is_empty() {
            return Ok(DownloadResult {
                success: true,
                downloaded_mods: vec![],
                failed_mods: vec![],
                total_size: 0,
                duration: start_time.elapsed().as_secs_f64(),
            });
        }
        
        // Download mods in parallel
        let mut downloaded_mods = Vec::new();
        let mut failed_mods = Vec::new();
        let mut total_size = 0u64;
        
        // Use parallel downloads with semaphore for rate limiting
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(4)); // Max 4 concurrent downloads
        let mut tasks = Vec::new();
        
        for plan in unique_plan {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let output_path_clone = output_path.clone();
            
            let task = tokio::spawn(async move {
                let result = download_mod(
                    &plan.mod_name,
                    &plan.version,
                    &plan.file_name,
                    &output_path_clone,
                ).await;
                
                drop(permit);
                
                match result {
                    Ok(size) => Ok((plan.mod_name.clone(), size)),
                    Err(e) => Err((plan.mod_name.clone(), e.to_string())),
                }
            });
            
            tasks.push(task);
        }
        
        // Wait for all downloads to complete
        for task in tasks {
            match task.await {
                Ok(Ok((mod_name, size))) => {
                    downloaded_mods.push(mod_name);
                    total_size += size;
                }
                Ok(Err((mod_name, error))) => {
                    failed_mods.push((mod_name, error));
                }
                Err(e) => {
                    failed_mods.push(("unknown".to_string(), e.to_string()));
                }
            }
        }
        
        let duration = start_time.elapsed().as_secs_f64();
        let success = failed_mods.is_empty();
        
        Ok(DownloadResult {
            success,
            downloaded_mods,
            failed_mods,
            total_size,
            duration,
        })
    })
}

/// Download multiple mods from a list of URLs
#[pyfunction]
#[pyo3(signature = (mod_urls, output_path, factorio_version="2.0", include_optional=true, include_optional_all=false, max_depth=10, continue_on_error=true))]
fn batch_download_mods(
    mod_urls: Vec<String>,
    output_path: String,
    factorio_version: &str,
    include_optional: bool,
    include_optional_all: bool,
    max_depth: usize,
    continue_on_error: bool,
) -> PyResult<DownloadResult> {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    
    runtime.block_on(async {
        let start_time = std::time::Instant::now();
        let mut all_downloaded = Vec::new();
        let mut all_failed = Vec::new();
        let mut total_size = 0u64;
        
        for mod_url in mod_urls {
            let result = download_mod_with_deps(
                mod_url.clone(),
                output_path.clone(),
                factorio_version,
                include_optional,
                include_optional_all,
                None,
                max_depth,
            )?;
            
            all_downloaded.extend(result.downloaded_mods);
            all_failed.extend(result.failed_mods.clone());
            total_size += result.total_size;
            
            if !result.success && !continue_on_error {
                break;
            }
        }
        
        let duration = start_time.elapsed().as_secs_f64();
        let success = all_failed.is_empty();
        
        Ok(DownloadResult {
            success,
            downloaded_mods: all_downloaded,
            failed_mods: all_failed,
            total_size,
            duration,
        })
    })
}

/// Update mod-list.json with downloaded mods
#[pyfunction]
#[pyo3(signature = (mod_names, mods_directory, enabled=true))]
fn update_mod_list_json(
    mod_names: Vec<String>,
    mods_directory: String,
    enabled: bool,
) -> PyResult<bool> {
    use std::path::PathBuf;
    
    let mod_list_path = PathBuf::from(&mods_directory).join("mod-list.json");
    
    // Read existing mod-list.json or create new structure
    let mut mod_list: serde_json::Value = if mod_list_path.exists() {
        let content = std::fs::read_to_string(&mod_list_path)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyIOError, _>(e.to_string()))?;
        serde_json::from_str(&content)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e.to_string()))?
    } else {
        serde_json::json!({"mods": []})
    };
    
    // Get existing mod names
    let existing_mods: HashSet<String> = mod_list["mods"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
        .collect();
    
    // Add new mods
    let mods_array = mod_list["mods"].as_array_mut().unwrap();
    let mut added_count = 0;
    
    for mod_name in mod_names {
        // Extract mod name from filename if it contains version
        let clean_mod_name = if mod_name.contains('_') && mod_name.ends_with(".zip") {
            // Format: "mod-name_version.zip" -> "mod-name"
            mod_name.split('_').next().unwrap_or(&mod_name).to_string()
        } else {
            mod_name.clone()
        };
        
        if !existing_mods.contains(&clean_mod_name) {
            mods_array.push(serde_json::json!({
                "name": clean_mod_name,
                "enabled": enabled
            }));
            added_count += 1;
        }
    }
    
    // Write updated mod-list.json
    if added_count > 0 {
        let content = serde_json::to_string_pretty(&mod_list)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyValueError, _>(e.to_string()))?;
        std::fs::write(&mod_list_path, content)
            .map_err(|e| PyErr::new::<pyo3::exceptions::PyIOError, _>(e.to_string()))?;
    }
    
    Ok(added_count > 0)
}

/// Python module
#[pymodule]
fn factorio_mod_downloader_rust(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(download_mod_with_deps, m)?)?;
    m.add_function(wrap_pyfunction!(batch_download_mods, m)?)?;
    m.add_function(wrap_pyfunction!(update_mod_list_json, m)?)?;
    m.add_class::<DownloadResult>()?;
    Ok(())
}
