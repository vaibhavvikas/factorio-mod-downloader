use crate::shared::*;
use std::collections::HashSet;
use std::time::Instant;
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use console::style;
use pyo3::prelude::*;

// Use the DownloadResult from lib.rs
pub use crate::DownloadResult;

pub async fn download_single_mod_enhanced(
    mod_url: String,
    output_path: String,
    factorio_version: String,
    include_optional: bool,
    include_optional_all: bool,
    target_mod_version: Option<String>,
    max_depth: usize,
) -> Result<DownloadResult, Box<dyn std::error::Error>> {
    let start_time = Instant::now();
    
    // Extract mod ID
    let mod_id = extract_mod_id(&mod_url)?;
    
    let config = Config {
        target_factorio_version: factorio_version.clone(),
        target_mod_version,
        install_optional_deps: include_optional,
        install_optional_all_deps: include_optional_all,
        max_depth,
    };
    
    // Display target Factorio version
    println!("{}", style(format!("Target Factorio version: {}", factorio_version)).dim());
    
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
    resolve_pb.set_message("🔍 Resolving dependencies...");
    
    let mut visited = HashSet::new();
    let download_plan = resolve_dependencies(
        &mod_id,
        &config,
        &mut visited,
        0,
        false,
    ).await?;
    
    // Remove duplicates
    let mut unique_plan: Vec<DownloadPlan> = Vec::new();
    let mut seen_mods: HashSet<String> = HashSet::new();
    
    for plan in download_plan {
        if !seen_mods.contains(&plan.mod_name) {
            seen_mods.insert(plan.mod_name.clone());
            unique_plan.push(plan);
        }
    }
    
    let resolve_time = resolve_start.elapsed();
    resolve_pb.finish_and_clear();
    
    if unique_plan.is_empty() {
        println!("{}", style("No compatible mods found").red().bold());
        return Ok(DownloadResult {
            success: false,
            downloaded_mods: vec![],
            failed_mods: vec![(mod_id, "No compatible mods found".to_string())],
            total_size: 0,
            duration: start_time.elapsed().as_secs_f64(),
        });
    }
    
    println!("{} {} in {:.2}s",
        style("✅ Resolved").bold().green(),
        style(format!("{} packages", unique_plan.len())).cyan().bold(),
        resolve_time.as_secs_f64()
    );
    
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
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    
    let install_time = download_start.elapsed();
    install_pb.finish_and_clear();
    
    // === ENHANCED SUMMARY ===
    println!("{} {} in {:.0}ms ({:.2} MB/s)",
        style("📥 Downloaded").bold().green(),
        style(format!("{} packages", stats.installed.len())).cyan().bold(),
        download_time.as_millis(),
        (total_bytes as f64 / 1024.0 / 1024.0) / download_time.as_secs_f64()
    );
    
    println!("{} {} in {:.0}ms",
        style("🔧 Installed").bold().green(),
        style(format!("{} packages", stats.installed.len())).cyan().bold(),
        install_time.as_millis()
    );
    
    // Show installed packages (UV-style + format with enhanced colors)
    for (name, version) in &stats.installed {
        println!(" {} {}=={}",
            style("+").green().bold(),
            style(name).white().bold(),
            style(version).dim()
        );
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
    
    // Show total size and speed summary
    if total_bytes > 0 {
        println!("\n{} Total downloaded: {} ({:.2} MB/s average)",
            style("📊").blue().bold(),
            style(format!("{:.2} MB", total_bytes as f64 / 1024.0 / 1024.0)).cyan().bold(),
            (total_bytes as f64 / 1024.0 / 1024.0) / download_time.as_secs_f64()
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

// PyO3 wrapper function
#[pyfunction(name = "download_mod_with_deps_enhanced")]
#[pyo3(signature = (mod_url, output_path, factorio_version="2.0", include_optional=true, include_optional_all=false, target_mod_version=None, max_depth=10))]
pub fn download_mod_with_deps_enhanced_py(
    mod_url: String,
    output_path: String,
    factorio_version: &str,
    include_optional: bool,
    include_optional_all: bool,
    target_mod_version: Option<String>,
    max_depth: usize,
) -> PyResult<DownloadResult> {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    
    runtime.block_on(download_single_mod_enhanced(
        mod_url,
        output_path,
        factorio_version.to_string(),
        include_optional,
        include_optional_all,
        target_mod_version,
        max_depth,
    )).map_err(|e| pyo3::exceptions::PyRuntimeError::new_err(format!("Download error: {}", e)))
}
