use common::emit_log;
use factorio::client::ApiClient;
use factorio::models::{ModDetailsResponse, ResolvedDownloadItem};
use factorio::mods::get_mod_details;
use factorio::resolver::Resolver;
use parser::models::Dependency;

/// Fetch single mod info + parsed dependencies for UI display
#[tauri::command]
pub async fn fetch_mod_details(
    api_client: tauri::State<'_, ApiClient>,
    mod_id: String,
) -> Result<ModDetailsResponse, String> {
    emit_log("info", &format!("Fetching mod details for \"{}\"...", mod_id));
    get_mod_details(&api_client, &mod_id)
        .await
        .map_err(|e| {
            let err_str = e.to_string();
            let msg = if err_str.contains("404") || err_str.contains("Not Found") {
                format!("Mod \"{}\" was not found on the Factorio Mod Portal.", mod_id)
            } else if err_str.contains("403") || err_str.contains("401") {
                "Access denied by Factorio Mod Portal. Please check your credentials in Settings.".to_string()
            } else if err_str.contains("500") || err_str.contains("502") || err_str.contains("503") || err_str.contains("504") {
                "Factorio Mod Portal server is temporarily unavailable.".to_string()
            } else {
                let stripped = err_str.split(" for url ").next().unwrap_or(&err_str);
                stripped.to_string()
            };
            emit_log("error", &format!("Failed to fetch details for \"{}\": {}", mod_id, msg));
            msg
        })
}

/// Resolve sub-dependencies for download queue
#[tauri::command]
pub async fn resolve_download_batch(
    api_client: tauri::State<'_, ApiClient>,
    main_mods: Vec<ResolvedDownloadItem>,
    direct_deps: Vec<Dependency>,
    include_recommended: bool,
    factorio_version: Option<String>,
) -> Result<Vec<ResolvedDownloadItem>, String> {
    emit_log("info", &format!("Resolving dependencies for {} mod(s)...", main_mods.len()));
    let mut resolver = Resolver::new(&api_client);

    match resolver.prepare_download_batch(
        main_mods,
        direct_deps,
        include_recommended,
        factorio_version.as_deref(),
    )
    .await
    {
        Ok(resolved) => {
            emit_log("success", &format!("Resolved {} total mod(s) to download.", resolved.len()));
            Ok(resolved)
        }
        Err(e) => {
            let err_msg = e.to_string();
            emit_log("error", &format!("Dependency resolution failed: {}", err_msg));
            Err(err_msg)
        }
    }
}
