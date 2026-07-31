use std::collections::{HashMap, HashSet, VecDeque};

use parser::{
    models::Dependency,
    parser::{parse_dependencies, satisfies_constraint},
};

use crate::{
    client::ApiClient,
    installed::{compare_versions, is_release_compatible},
    models::{ModInfo, ResolvedDownloadItem},
    mods::get_mod,
};

pub struct Resolver<'client> {
    api_client: &'client ApiClient,
    cache: HashMap<String, ModInfo>,
}

impl<'client> Resolver<'client> {
    pub fn new(api_client: &'client ApiClient) -> Self {
        Self {
            api_client,
            cache: HashMap::new(),
        }
    }

    pub async fn fetch_mod(&mut self, mod_id: &str) -> Result<ModInfo, Box<dyn std::error::Error>> {
        if let Some(cache_info) = self.cache.get(mod_id) {
            return Ok(cache_info.clone());
        }
        let mod_info = get_mod(self.api_client, mod_id).await?;
        self.cache.insert(mod_id.to_string(), mod_info.clone());
        Ok(mod_info)
    }

    pub async fn resolve_deps(
        &mut self,
        target_mods: Vec<Dependency>,
        include_recommended: bool,
        target_factorio_version: Option<&str>,
    ) -> Result<Vec<ResolvedDownloadItem>, Box<dyn std::error::Error>> {
        let mut queue: VecDeque<Dependency> = VecDeque::from(target_mods);
        let mut visited: HashSet<String> = HashSet::new();
        let mut resolved_mods: Vec<ResolvedDownloadItem> = Vec::new();

        while let Some(dep) = queue.pop_front() {
            if visited.contains(&dep.id) {
                continue;
            }

            visited.insert(dep.id.clone());

            let mod_info = match self.fetch_mod(&dep.id).await {
                Ok(info) => info,
                Err(e) => {
                    eprintln!("Warning: Could not fetch mod '{}': {}", dep.id, e);
                    continue;
                }
            };

            let mut releases_sorted = mod_info.releases.clone();
            releases_sorted.sort_by(|a, b| compare_versions(&b.version, &a.version));

            let selected_release = releases_sorted
                .iter()
                .find(|rel| {
                    let rel_fver = rel.info_json.as_ref().and_then(|i| i.factorio_version.as_deref());
                    is_release_compatible(rel_fver, target_factorio_version)
                        && satisfies_constraint(&rel.version, &dep.ineq, &dep.version)
                })
                .or_else(|| {
                    releases_sorted.iter().find(|rel| {
                        let rel_fver = rel.info_json.as_ref().and_then(|i| i.factorio_version.as_deref());
                        is_release_compatible(rel_fver, target_factorio_version)
                    })
                })
                .or_else(|| releases_sorted.first());

            if let Some(release) = selected_release {
                resolved_mods.push(ResolvedDownloadItem {
                    id: mod_info.name.clone(),
                    title: mod_info.title.clone(),
                    version: release.version.clone(),
                    file_name: release.file_name.clone(),
                    sha1: release.sha1.clone(),
                });

                let dep_strings = release
                    .info_json
                    .as_ref()
                    .and_then(|info| info.dependencies.clone());
                let parsed = parse_dependencies(&dep_strings);

                for req_dep in parsed.required {
                    if !visited.contains(&req_dep.id) {
                        queue.push_back(req_dep);
                    }
                }
                if include_recommended {
                    for rec_dep in parsed.recommended {
                        if !visited.contains(&rec_dep.id) {
                            queue.push_back(rec_dep);
                        }
                    }
                }
            }
        }

        Ok(resolved_mods)
    }

    pub async fn prepare_download_batch(
        &mut self,
        main_mods: Vec<ResolvedDownloadItem>,
        direct_deps: Vec<Dependency>,
        include_recommended: bool,
        target_factorio_version: Option<&str>,
    ) -> Result<Vec<ResolvedDownloadItem>, Box<dyn std::error::Error>> {
        let mut final_list = main_mods;

        let resolved_sub_deps = self
            .resolve_deps(direct_deps, include_recommended, target_factorio_version)
            .await?;

        for sub_dep in resolved_sub_deps {
            if !final_list.iter().any(|item| item.id == sub_dep.id) {
                final_list.push(sub_dep);
            }
        }
        Ok(final_list)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::client::ApiClient;
    use crate::utils::is_ci;

    #[tokio::test]
    async fn test_resolve_krastorio2_deps() {
        if is_ci() {
            eprintln!("skipping network test in CI: test_resolve_krastorio2_deps");
            return;
        }

        let api_client = ApiClient::new();
        let mut resolver = Resolver::new(&api_client);

        let initial_deps = vec![Dependency {
            id: "Krastorio2".to_string(),
            ineq: String::new(),
            version: String::new(),
        }];

        let result = resolver.resolve_deps(initial_deps, false, None).await;
        assert!(result.is_ok());

        let resolved = result.unwrap();
        println!("Resolved {} dependencies for Krastorio2:", resolved.len());
        for item in &resolved {
            println!(" - {} (v{}) -> {}", item.id, item.version, item.file_name);
        }

        assert!(!resolved.is_empty());
    }
}
