use factorio::client::ApiClient;
use factorio::models::{ModDetailsResponse, ModSearchResponse, ModSearchResultItem, ResolvedDownloadItem};
use factorio::mods::{get_mod_details, search_mods as factorio_search_mods, search_mods_page as factorio_search_mods_page};
use factorio::resolver::Resolver;
use parser::models::Dependency;

/// Tauri Command 1: Search Factorio Mod Portal
#[tauri::command]
pub async fn search_mods(
    api_client: tauri::State<'_, ApiClient>,
    query: String,
    factorio_version: Option<String>,
) -> Result<Vec<ModSearchResultItem>, String> {
    factorio_search_mods(&api_client, &query, factorio_version.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browse_mods(
    api_client: tauri::State<'_, ApiClient>,
    query: Option<String>,
    category: Option<String>,
    categories: Option<Vec<String>>,
    expansion: Option<String>,
    factorio_version: Option<String>,
    page: u32,
) -> Result<ModSearchResponse, String> {
    let mut cats = categories.unwrap_or_default();
    if let Some(single_cat) = category
        && !single_cat.trim().is_empty()
        && single_cat != "all"
        && !cats.contains(&single_cat)
    {
        cats.push(single_cat);
    }

    factorio_search_mods_page(
        &api_client,
        query.as_deref().unwrap_or_default(),
        &cats,
        expansion.as_deref(),
        factorio_version.as_deref(),
        page,
    )
    .await
    .map_err(|e| e.to_string())
}

/// Tauri Command 2: Fetch single mod info + parsed dependencies for UI display
#[tauri::command]
pub async fn fetch_mod_details(
    api_client: tauri::State<'_, ApiClient>,
    mod_id: String,
) -> Result<ModDetailsResponse, String> {
    get_mod_details(&api_client, &mod_id)
        .await
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("404") || err_str.contains("Not Found") {
                format!("Mod \"{}\" was not found on the Factorio Mod Portal.", mod_id)
            } else if err_str.contains("403") || err_str.contains("401") {
                "Access denied by Factorio Mod Portal. Please check your credentials in Settings.".to_string()
            } else if err_str.contains("500") || err_str.contains("502") || err_str.contains("503") || err_str.contains("504") {
                "Factorio Mod Portal server is temporarily unavailable.".to_string()
            } else {
                let stripped = err_str.split(" for url ").next().unwrap_or(&err_str);
                stripped.to_string()
            }
        })
}

/// Tauri Command 2: Resolve sub-dependencies for download queue
#[tauri::command]
pub async fn resolve_download_batch(
    api_client: tauri::State<'_, ApiClient>,
    main_mods: Vec<ResolvedDownloadItem>,
    direct_deps: Vec<Dependency>,
    include_recommended: bool,
    factorio_version: Option<String>,
) -> Result<Vec<ResolvedDownloadItem>, String> {
    let mut resolver = Resolver::new(&api_client);

    resolver.prepare_download_batch(
        main_mods,
        direct_deps,
        include_recommended,
        factorio_version.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}
