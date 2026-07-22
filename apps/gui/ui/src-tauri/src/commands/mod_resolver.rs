use factorio::client::ApiClient;
use factorio::models::ResolvedDownloadItem;
use factorio::resolver::{Resolver};
use parser::models::{Dependencies, Dependency};
use parser::parser::parse_dependencies;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ModDetailsResponse {
    pub name: String,
    pub title: String,
    pub owner: String,
    pub category: String,
    pub summary: String,
    pub thumbnail: Option<String>,
    pub updated_at: String,
    pub downloads_count: u64,
    pub releases: Vec<ReleaseSummary>,
    pub default_dependencies: Dependencies,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReleaseSummary {
    pub version: String,
    pub factorio_version: String,
    pub released_at: String,
}

/// Tauri Command 1: Fetch single mod info + parsed dependencies for UI display
#[tauri::command]
pub async fn fetch_mod_details(mod_id: String) -> Result<ModDetailsResponse, String> {
    let client = ApiClient::new();
    let mod_info = factorio::mods::get_mod(&client, &mod_id)
        .await
        .map_err(|e| e.to_string())?;

    let releases_summary: Vec<ReleaseSummary> = mod_info
        .releases
        .iter()
        .map(|r| ReleaseSummary {
            version: r.version.clone(),
            factorio_version: r
                .info_json
                .as_ref()
                .and_then(|info| info.factorio_version.clone())
                .unwrap_or_else(|| "2.0".to_string()),
            released_at: r.released_at.clone(),
        })
        .collect();

    // Parse dependencies for the latest release
    let default_deps = if let Some(latest_release) = mod_info.releases.last() {
        let dep_strings = latest_release
            .info_json
            .as_ref()
            .and_then(|info| info.dependencies.clone());
        parse_dependencies(&dep_strings)
    } else {
        Dependencies::default()
    };

    Ok(ModDetailsResponse {
        name: mod_info.name,
        title: mod_info.title,
        owner: mod_info.owner,
        category: mod_info.category,
        summary: mod_info.summary,
        thumbnail: mod_info.thumbnail.map(|t| {
            if t.starts_with('/') {
                format!("https://mods-data.factorio.com{}", t)
            } else {
                t
            }
        }),
        updated_at: mod_info.updated_at,
        downloads_count: mod_info.downloads_count,
        releases: releases_summary,
        default_dependencies: default_deps,
    })
}

/// Tauri Command 2: Resolve sub-dependencies for download queue
#[tauri::command]
pub async fn resolve_download_batch(
    main_mods: Vec<ResolvedDownloadItem>,
    direct_deps: Vec<Dependency>,
    include_recommended: bool,
) -> Result<Vec<ResolvedDownloadItem>, String> {
    let client = ApiClient::new();
    let mut resolver = Resolver::new(&client);

    Resolver::prepare_download_batch(
        &mut resolver,
        main_mods,
        direct_deps,
        include_recommended,
    )
    .await
    .map_err(|e| e.to_string())
}
