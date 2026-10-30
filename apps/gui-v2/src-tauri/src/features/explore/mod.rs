use common::emit_log;
use factorio::client::ApiClient;
use factorio::models::ModSearchResponse;
use factorio::mods::search_mods_page as factorio_search_mods_page;

/// Tauri Command: Browse Factorio Mod Portal with filters & pagination
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

    let q_display = query.as_deref().unwrap_or("");
    let ver_display = factorio_version.as_deref().unwrap_or("any");
    let search_desc = if q_display.trim().is_empty() {
        format!("Browsing Mod Portal (page {}, Factorio {})...", page, ver_display)
    } else {
        format!("Searching mods: \"{}\" (page {}, Factorio {})...", q_display, page, ver_display)
    };
    emit_log("info", &search_desc);

    match factorio_search_mods_page(
        &api_client,
        query.as_deref().unwrap_or_default(),
        &cats,
        expansion.as_deref(),
        factorio_version.as_deref(),
        page,
    )
    .await
    {
        Ok(res) => {
            emit_log(
                "success",
                &format!(
                    "Loaded {} mod(s) (page {} of {})",
                    res.results.len(),
                    res.page,
                    res.total_pages
                ),
            );
            Ok(res)
        }
        Err(e) => {
            let err_msg = e.to_string();
            emit_log("error", &format!("Mod Portal request failed: {}", err_msg));
            Err(err_msg)
        }
    }
}
