use crate::client::ApiClient;
use crate::models::{
    ModDetailsResponse, ModInfo, ModSearchResponse, ModSearchResultItem, ReleaseSummary,
};
use parser::models::Dependencies;
use parser::parser::parse_dependencies;

const MOD_PORTAL_API_URL: &str = "https://mods.factorio.com/api/mods";

/// Fetch raw mod info from the Factorio Mod Portal API
pub async fn get_mod(
    api_client: &ApiClient,
    mod_id: &str,
) -> Result<ModInfo, Box<dyn std::error::Error>> {
    let url = format!("{}/{}/full", MOD_PORTAL_API_URL, mod_id);
    let response = api_client.get(&url, &[]).await?;

    let mod_info: ModInfo = serde_json::from_str(&response)?;
    Ok(mod_info)
}

/// Search Factorio Mod Portal by querying web search endpoint (https://mods.factorio.com/search)
pub async fn search_mods(
    api_client: &ApiClient,
    query: &str,
    factorio_version: Option<&str>,
) -> Result<Vec<ModSearchResultItem>, Box<dyn std::error::Error>> {
    Ok(
        search_mods_page(api_client, query, &[], None, factorio_version, 1)
            .await?
            .results,
    )
}

/// Browse or search the Mod Portal with server-side category filtering and pagination.
pub async fn search_mods_page(
    api_client: &ApiClient,
    query: &str,
    categories: &[String],
    expansion: Option<&str>,
    factorio_version: Option<&str>,
    page: u32,
) -> Result<ModSearchResponse, Box<dyn std::error::Error>> {
    let trimmed = query.trim();
    let has_categories = categories.iter().any(|c| !c.trim().is_empty() && c.trim() != "all");
    let has_expansion = expansion.is_some_and(|e| !e.trim().is_empty() && e.trim() != "all");
    let has_version_filter = factorio_version.is_some_and(|version| {
        let value = version.trim().to_lowercase();
        !value.is_empty() && value != "all" && value != "any"
    });

    let url = if trimmed.is_empty() && !has_categories && !has_expansion && !has_version_filter {
        if page <= 1 {
            "https://mods.factorio.com/".to_string()
        } else {
            format!("https://mods.factorio.com/{}", page)
        }
    } else if trimmed.is_empty() {
        "https://mods.factorio.com/browse".to_string()
    } else {
        "https://mods.factorio.com/search".to_string()
    };
    let mut params = vec![("exclude_category", "internal")];

    if !trimmed.is_empty() {
        params.push(("query", trimmed));
    }

    for cat in categories {
        let cat_trimmed = cat.trim();
        if !cat_trimmed.is_empty() && cat_trimmed != "all" {
            params.push(("category", cat_trimmed));
        }
    }

    if let Some(exp) = expansion {
        let exp_trimmed = exp.trim();
        if !exp_trimmed.is_empty() && exp_trimmed != "all" {
            params.push(("expansion", exp_trimmed));
        }
    }

    let page_number = page.max(1).to_string();
    params.push(("page", &page_number));

    if let Some(ver) = factorio_version
        && !ver.trim().is_empty()
        && !matches!(ver.trim().to_lowercase().as_str(), "all" | "any")
    {
        params.push(("factorio_version", ver.trim()));
    }

    let html = api_client.get(&url, &params).await?;

    let mut results: Vec<ModSearchResultItem> = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    // Regex to match mod title link: href="/mod/NAME?from=search" ... >...</a>
    let card_re =
        regex::Regex::new(r#"(?s)href="/mod/([a-zA-Z0-9_\-]+)(?:\?[^"]*)?"[^>]*>\s*(.*?)\s*</a>"#)?;

    // Regex for owner link: href="/user/OWNER"
    let owner_re = regex::Regex::new(r#"href="/user/([a-zA-Z0-9_\-]+)""#)?;

    // Regex for thumbnail: src="(https://assets-mod.factorio.com/[^"]+)" or src="(/assets/[^"]+)"
    let thumb_re =
        regex::Regex::new(r#"src="([^"]+(?:assets-mod\.factorio\.com|/assets/)[^"]+)""#)?;

    // Regex for summary text inside result paragraph
    let summary_re = regex::Regex::new(
        r#"(?s)<p[^>]*class="[^"]*result-field[^"]*"[^>]*>(.*?)(?:</p>|</div>)"#,
    )?;

    // Regex for category tag
    let category_re =
        regex::Regex::new(r#"(?s)category-label"[^>]*>\s*(?:<i[^>]*>.*?</i>)?\s*([^<\r\n]+)"#)?;
    let category_tooltip_re = regex::Regex::new(r#"(?s)Mod category:\s*([^<\r\n]+)"#)?;
    let tags_section_re = regex::Regex::new(
        r#"(?s)<div class="flex flex-wrap mod-tags">(.*?)</div>\s*<div class="text-right"#,
    )?;
    let tag_re =
        regex::Regex::new(r#"(?s)<span class="slot-button-inline result-field">\s*([^<\r\n]+)"#)?;

    // Regex for downloads count: title="Downloads[^"]*" ... <span title="404857">
    let downloads_re =
        regex::Regex::new(r#"(?s)title="Downloads[^"]*"[^>]*>.*?<span title="(\d+)">"#)?;

    let clean_tags_re = regex::Regex::new(r"<[^>]*>")?;
    let collapsed_re = regex::Regex::new(r"\s+")?;

    // Helper to unescape basic HTML entities
    let unescape = |s: &str| -> String {
        s.replace("&amp;", "&")
            .replace("&#39;", "'")
            .replace("&quot;", "\"")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
    };

    // Split HTML into mod card blocks
    let blocks: Vec<&str> = html
        .split("class=\"panel-inset-lighter flex-column")
        .collect();

    for block in blocks.iter().skip(1) {
        let full_block = format!("class=\"panel-inset-lighter flex-column{}", block);

        let mut mod_name = String::new();
        let mut title = String::new();

        for cap in card_re.captures_iter(&full_block) {
            let name = cap[1].trim().to_string();
            let clean = clean_tags_re.replace_all(&cap[2], "");
            let text = unescape(clean.trim());
            if !name.is_empty() && !text.is_empty() {
                mod_name = name;
                title = text;
                break;
            } else if mod_name.is_empty() {
                mod_name = name;
            }
        }

        if mod_name.is_empty() || seen_names.contains(&mod_name) {
            continue;
        }
        seen_names.insert(mod_name.clone());

        let owner = owner_re
            .captures(&full_block)
            .map(|c| c[1].to_string())
            .unwrap_or_else(|| "Author".to_string());

        let raw_category = category_tooltip_re
            .captures(&full_block)
            .or_else(|| category_re.captures(&full_block))
            .map(|c| c[1].trim().to_lowercase())
            .unwrap_or_else(|| "content".to_string());

        // Map web display category names to clean pills e.g. "overhaul", "quality of life"
        let category = match raw_category.as_str() {
            "internal" => "internal".to_string(),
            "overhaul" => "overhaul".to_string(),
            "quality of life" | "qol" => "qol".to_string(),
            "helper-libs" | "library" | "libraries" => "helper-libs".to_string(),
            other => other.to_string(),
        };

        let downloads_count = downloads_re
            .captures(&full_block)
            .and_then(|c| c[1].parse::<u64>().ok())
            .unwrap_or(0);

        let thumbnail = thumb_re.captures(&full_block).map(|c| {
            let src = &c[1];
            if src.starts_with('/') {
                format!("https://mods-data.factorio.com{}", src)
            } else {
                src.to_string()
            }
        });

        let summary = summary_re
            .captures(&full_block)
            .map(|c| {
                let text = c[1]
                    .replace("<br>", " ")
                    .replace("<br/>", " ")
                    .replace(['\n', '\r'], " ");
                let clean = clean_tags_re.replace_all(&text, " ");
                let collapsed = collapsed_re.replace_all(&clean, " ");
                unescape(collapsed.trim())
            })
            .unwrap_or_default();

        let tags = tags_section_re
            .captures(&full_block)
            .map(|section| {
                tag_re
                    .captures_iter(&section[1])
                    .map(|tag| unescape(tag[1].trim()))
                    .filter(|tag| !tag.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        let formatted_title = if title.is_empty() {
            mod_name.clone()
        } else {
            title
        };

        let requires_space_age = full_block.contains("Requires Factorio: Space Age")
            || full_block.contains("logo-expansion-space-age")
            || full_block.contains("expansion=space-age");

        results.push(ModSearchResultItem {
            name: mod_name,
            title: formatted_title,
            owner,
            summary,
            category,
            downloads_count,
            thumbnail,
            latest_version: String::new(),
            tags,
            requires_space_age,
        });

        if results.len() >= 20 {
            break;
        }
    }

    // The portal emits links for the first/last page in its pagination controls.
    // Taking the greatest page number keeps the UI independent of its exact markup.
    let page_re = regex::Regex::new(r#"(?:[?&]|&amp;)page=(\d+)"#)?;
    let path_page_re = regex::Regex::new(r#"href="/(\d+)(?:[?\"]|$)"#)?;
    let total_pages = page_re
        .captures_iter(&html)
        .filter_map(|capture| capture[1].parse::<u32>().ok())
        .chain(
            path_page_re
                .captures_iter(&html)
                .filter_map(|capture| capture[1].parse::<u32>().ok()),
        )
        .max()
        .unwrap_or(page.max(1));

    Ok(ModSearchResponse {
        results,
        page: page.max(1),
        total_pages,
    })
}

/// Fetch mod details response formatted for UI consumption
pub async fn get_mod_details(
    api_client: &ApiClient,
    mod_id: &str,
) -> Result<ModDetailsResponse, Box<dyn std::error::Error>> {
    let mod_info = get_mod(api_client, mod_id).await?;

    let releases_summary: Vec<ReleaseSummary> = mod_info
        .releases
        .iter()
        .map(|r| {
            let dep_strings = r
                .info_json
                .as_ref()
                .and_then(|info| info.dependencies.clone());
            ReleaseSummary {
                version: r.version.clone(),
                factorio_version: r
                    .info_json
                    .as_ref()
                    .and_then(|info| info.factorio_version.clone()),
                released_at: r.released_at.clone(),
                dependencies: parse_dependencies(&dep_strings),
            }
        })
        .collect();

    let formatted_thumbnail = mod_info.thumbnail.as_ref().map(|t| {
        if t.starts_with('/') {
            format!("https://mods-data.factorio.com{}", t)
        } else {
            t.clone()
        }
    });

    let default_deps = get_latest_dependencies(&mod_info);

    Ok(ModDetailsResponse {
        name: mod_info.name,
        title: mod_info.title,
        owner: mod_info.owner,
        category: mod_info.category,
        summary: mod_info.summary,
        thumbnail: formatted_thumbnail,
        updated_at: mod_info.updated_at,
        downloads_count: mod_info.downloads_count,
        releases: releases_summary,
        default_dependencies: default_deps,
    })
}

/// Parse dependencies for the latest release of a mod
pub fn get_latest_dependencies(mod_info: &ModInfo) -> Dependencies {
    if let Some(latest_release) = mod_info.releases.last() {
        let dep_strings = latest_release
            .info_json
            .as_ref()
            .and_then(|info| info.dependencies.clone());
        parse_dependencies(&dep_strings)
    } else {
        Dependencies::default()
    }
}

/// Fetch dependencies for a specific version of a mod
pub async fn get_version_dependencies(
    api_client: &ApiClient,
    mod_id: &str,
    version: &str,
) -> Result<Dependencies, Box<dyn std::error::Error>> {
    let mod_info = get_mod(api_client, mod_id).await?;

    let release = mod_info.releases.iter().find(|r| r.version == version);

    if let Some(rel) = release {
        let dep_strings = rel
            .info_json
            .as_ref()
            .and_then(|info| info.dependencies.clone());
        Ok(parse_dependencies(&dep_strings))
    } else {
        Err(format!("Version {} not found for mod {}", version, mod_id).into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::is_ci;

    #[tokio::test]
    async fn test_call_get_mod() {
        if is_ci() {
            eprintln!("skipping network test in CI: test_call_get_mod");
            return;
        }

        let api_client = ApiClient::new();
        let mod_info = get_mod(&api_client, "Krastorio2").await.unwrap();

        assert_eq!(mod_info.name, "Krastorio2");
        assert_eq!(mod_info.title, "Krastorio 2");
        assert_eq!(mod_info.owner, "raiguard");
        assert_eq!(mod_info.category, "overhaul");
        assert!(!mod_info.releases.is_empty());
    }

    #[tokio::test]
    async fn test_get_nonexistent_mod() {
        if is_ci() {
            eprintln!("skipping network test in CI: test_get_nonexistent_mod");
            return;
        }

        let api_client = ApiClient::new();
        let result = get_mod(&api_client, "NonExistentMod12345").await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_search_mods() {
        if is_ci() {
            eprintln!("skipping network test in CI: test_search_mods");
            return;
        }

        let api_client = ApiClient::new();
        let results = search_mods(&api_client, "krastorio", Some("2.0"))
            .await
            .unwrap();
        assert!(!results.is_empty());
        assert!(results.iter().any(|m| m.name.contains("Krastorio")));
    }
}
