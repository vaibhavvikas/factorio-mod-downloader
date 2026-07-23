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
    if let Some(single_cat) = category {
        if !single_cat.trim().is_empty() && single_cat != "all" && !cats.contains(&single_cat) {
            cats.push(single_cat);
        }
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
        .map_err(|e| e.to_string())
}

/// Tauri Command 2: Resolve sub-dependencies for download queue
#[tauri::command]
pub async fn resolve_download_batch(
    api_client: tauri::State<'_, ApiClient>,
    main_mods: Vec<ResolvedDownloadItem>,
    direct_deps: Vec<Dependency>,
    include_recommended: bool,
) -> Result<Vec<ResolvedDownloadItem>, String> {
    let mut resolver = Resolver::new(&api_client);

    Resolver::prepare_download_batch(
        &mut resolver,
        main_mods,
        direct_deps,
        include_recommended,
    )
    .await
    .map_err(|e| e.to_string())
}
