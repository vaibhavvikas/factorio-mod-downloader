use crate::shared::*;
// Use the DownloadResult from lib.rs
pub use crate::DownloadResult;
use std::collections::HashSet;
use std::time::Instant;
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use console::style;
use pyo3::prelude::*;
use serde_json::Value;

#[derive(Debug, serde::Deserialize)]
struct BatchFile {
    name: Option<String>,
    description: Option<String>,
    version: Option<String>,
    author: Option<String>,
    mods: Vec<String>,
}

pub async fn batch_download_mods_enhanced(
    mod_urls: Vec<String>,
    output_path: String,
    factorio_version: String,
    include_optional: bool,
    include_optional_all: bool,
    max_depth: usize,
    continue_on_error: bool,
) -> Result<DownloadResult, Box<dyn std::error::Error>> {
    let start_time = Instant::now();
    
    if mod_urls.is_empty() {
        return Ok(DownloadResult {
            success: false,
            downloaded_mods: vec![],
            failed_mods: vec![("batch".to_string(), "No mod URLs provided".to_string())],
            total_size: 0,
            duration: 0.0,
        });
    }
    
    println!("{}", style(format!("Target Factorio version: {}", factorio_version)).dim());
    println!("{}", style(format!("Processing {} mod URLs from batch", mod_urls.len())).dim());
    
    // === RESOLVING PHASE ===
    let resolve_start = Instant::now();
    let multi = MultiProgress::new();
    
    let resolve_pb = multi.add(ProgressBar::new_spinner());
    resolve_pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
    );
    resolve_pb.enable_steady_tick(std::time::Duration::from_millis(80));
    resolve_pb.set_message("🔍 Resolving dependencies for batch...");
    
    let config = Config {
        target_factorio_version: factorio_version.clone(),
        target_mod_version: None,
        install_optional_deps: include_optional,
        install_optional_all_deps: include_optional_all,
        max_depth,
    };
    
    let mut all_plans = Vec::new();
    let mut resolve_errors = Vec::new();
    
    // Resolve dependencies for each mod URL
    for mod_url in &mod_urls {
        match extract_mod_id(mod_url) {
            Ok(mod_id) => {
                let mut visited = HashSet::new();
                match resolve_dependencies(&mod_id, &config, &mut visited, 0, false).await {
                    Ok(plans) => all_plans.extend(plans),
                    Err(e) => resolve_errors.push((mod_url.clone(), e.to_string())),
                }
            }
            Err(e) => resolve_errors.push((mod_url.clone(), e.to_string())),
        }
    }
    
    // Remove duplicates across all mods
    let mut unique_plan: Vec<DownloadPlan> = Vec::new();
    let mut seen_mods: HashSet<String> = HashSet::new();
    
    for plan in all_plans {
        if !seen_mods.contains(&plan.mod_name) {
            seen_mods.insert(plan.mod_name.clone());
            unique_plan.push(plan);
        }
    }
    
    let resolve_time = resolve_start.elapsed();
    resolve_pb.finish_and_clear();
    
    if unique_plan.is_empty() && resolve_errors.is_empty() {
        println!("{}", style("No compatible mods found in batch").red().bold());
        return Ok(DownloadResult {
            success: false,
            downloaded_mods: vec![],
            failed_mods: vec![("batch".to_string(), "No compatible mods found".to_string())],
            total_size: 0,
            duration: start_time.elapsed().as_secs_f64(),
        });
    }
    
    println!("{} {} in {:.2}s",
        style("✅ Resolved").bold().green(),
        style(format!("{} packages", unique_plan.len())).cyan().bold(),
        resolve_time.as_secs_f64()
    );
    
    if !resolve_errors.is_empty() {
        println!("{} {} resolution errors",
            style("⚠").yellow().bold(),
            style(resolve_errors.len()).yellow().bold()
        );
    }
    
    // === DOWNLOADING PHASE ===
    let download_start = Instant::now();
    let download_pb = multi.add(ProgressBar::new(unique_plan.len() as u64));
    download_pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.cyan} [{bar:40.cyan/blue}] {pos}/{len} {msg} {bytes}/{total_bytes} ({bytes_per_sec}, {eta})")
            .unwrap()
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
            .progress_chars("█░")
    );
    download_pb.enable_steady_tick(std::time::Duration::from_millis(80));
    
    let mut stats = DownloadStats {
        installed: Vec::new(),
        failed: Vec::new(),
    };
    
    // Add resolve errors to failed list
    for (url, error) in resolve_errors {
        stats.failed.push((url, error));
    }
    
    let mut total_bytes = 0u64;
    
    for (i, plan) in unique_plan.iter().enumerate() {
        download_pb.set_message(format!("📦 Downloading {}", style(&plan.mod_name).cyan().bold()));
        
        match download_mod(&plan.mod_name, &plan.version, &plan.file_name, &output_path).await {
            Ok(size) => {
                stats.installed.push((plan.mod_name.clone(), plan.version.clone()));
                total_bytes += size;
                download_pb.set_length(total_bytes);
                download_pb.set_position((i + 1) as u64 * total_bytes / unique_plan.len() as u64);
            }
            Err(e) => {
                stats.failed.push((plan.mod_name.clone(), e.to_string()));
                if !continue_on_error {
                    break;
                }
            }
        }
        
        download_pb.inc(1);
    }
    
    let download_time = download_start.elapsed();
    download_pb.finish_and_clear();
    
    // === INSTALLING PHASE ===
    let install_pb = multi.add(ProgressBar::new_spinner());
    install_pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} {msg}")
            .unwrap()
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
    );
    install_pb.enable_steady_tick(std::time::Duration::from_millis(80));
    install_pb.set_message("🔧 Installing packages...");
    
    // Simulate install time (files are already written)
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    
    let install_time = download_start.elapsed();
    install_pb.finish_and_clear();
    
    // === ENHANCED BATCH SUMMARY ===
    println!("{} {} in {:.0}ms ({:.2} MB/s)",
        style("📥 Downloaded").bold().green(),
        style(format!("{} packages", stats.installed.len())).cyan().bold(),
        download_time.as_millis(),
        if download_time.as_secs_f64() > 0.0 {
            (total_bytes as f64 / 1024.0 / 1024.0) / download_time.as_secs_f64()
        } else { 0.0 }
    );
    
    println!("{} {} in {:.0}ms",
        style("🔧 Installed").bold().green(),
        style(format!("{} packages", stats.installed.len())).cyan().bold(),
        install_time.as_millis()
    );
    
    // Show installed packages (UV-style + format with enhanced colors)
    if !stats.installed.is_empty() {
        println!("\n{} Installed packages:", style("📦").green().bold());
        for (name, version) in &stats.installed {
            println!(" {} {}=={}",
                style("+").green().bold(),
                style(name).white().bold(),
                style(version).dim()
            );
        }
    }
    
    // Show failures if any with enhanced error display
    if !stats.failed.is_empty() {
        println!("\n{} Failed downloads:", style("⚠").yellow().bold());
        for (name, error) in &stats.failed {
            println!(" {} {} - {}",
                style("-").red().bold(),
                style(name).white().bold(),
                style(error).red().dim()
            );
        }
    }
    
    // Show batch statistics
    println!("\n{} Batch Summary:",
        style("📊").blue().bold()
    );
    println!("  • Total URLs processed: {}",
        style(mod_urls.len()).cyan().bold()
    );
    println!("  • Unique packages resolved: {}",
        style(unique_plan.len()).cyan().bold()
    );
    println!("  • Successfully installed: {}",
        style(stats.installed.len()).green().bold()
    );
    println!("  • Failed: {}",
        style(stats.failed.len()).red().bold()
    );
    
    if total_bytes > 0 {
        println!("  • Total downloaded: {} ({:.2} MB/s average)",
            style(format!("{:.2} MB", total_bytes as f64 / 1024.0 / 1024.0)).cyan().bold(),
            if download_time.as_secs_f64() > 0.0 {
                (total_bytes as f64 / 1024.0 / 1024.0) / download_time.as_secs_f64()
            } else { 0.0 }
        );
    }
    
    Ok(DownloadResult {
        success: stats.failed.is_empty(),
        downloaded_mods: stats.installed.iter().map(|(name, _)| name.clone()).collect(),
        failed_mods: stats.failed,
        total_size: total_bytes,
        duration: start_time.elapsed().as_secs_f64(),
    })
}

// Helper function to parse JSON batch file
pub fn parse_batch_file(json_content: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    // Try to parse as structured batch file first
    if let Ok(batch_file) = serde_json::from_str::<BatchFile>(json_content) {
        return Ok(batch_file.mods);
    }
    
    // Fallback: try to parse as simple array of strings
    if let Ok(urls) = serde_json::from_str::<Vec<String>>(json_content) {
        return Ok(urls);
    }
    
    // Last resort: try to parse as generic JSON and extract URLs
    if let Ok(value) = serde_json::from_str::<Value>(json_content) {
        if let Some(mods) = value.get("mods") {
            if let Some(mods_array) = mods.as_array() {
                let urls: Result<Vec<String>, _> = mods_array
                    .iter()
                    .map(|v| v.as_str().ok_or("Invalid mod URL").map(|s| s.to_string()))
                    .collect();
                return urls.map_err(|e| e.into());
            }
        }
    }
    
    Err("Could not parse batch file - expected JSON with 'mods' array or simple array of URLs".into())
}

// PyO3 wrapper function
#[pyfunction(name = "batch_download_mods_enhanced")]
#[pyo3(signature = (mod_urls, output_path, factorio_version="2.0", include_optional=true, include_optional_all=false, max_depth=10, continue_on_error=true))]
pub fn batch_download_mods_enhanced_py(
    mod_urls: Vec<String>,
    output_path: String,
    factorio_version: &str,
    include_optional: bool,
    include_optional_all: bool,
    max_depth: usize,
    continue_on_error: bool,
) -> PyResult<DownloadResult> {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    
    runtime.block_on(batch_download_mods_enhanced(
        mod_urls,
        output_path,
        factorio_version.to_string(),
        include_optional,
        include_optional_all,
        max_depth,
        continue_on_error,
    )).map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(format!("Batch download error: {}", e)))
}
