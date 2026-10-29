use crate::manifest::{load_manifest, save_manifest};
use crate::models::{
    AggregateState, ChildNode, GroupAggregate, GroupKind, HealthIssue, InstalledManifest,
    InstalledModGroup, ManifestModEntry, ModGroupGraph, ModReference, ReferenceKind,
    StashedModVersion,
};
use factorio::installed::{compare_versions, is_virtual_mod, read_mod_list, scan_installed_mods, write_mod_list_atomic, VIRTUAL_CORE_MODS};
use parser::parser::parse_dependencies;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

pub fn stash_dir(mods_folder: &Path) -> std::path::PathBuf {
    mods_folder.join(".factorio-mod-downloader").join("versions")
}

pub fn get_installed_mod_groups(
    mods_folder: &Path,
    app_data_dir: &Path,
) -> Vec<InstalledModGroup> {
    let mod_list = read_mod_list(mods_folder).unwrap_or_else(|_| factorio::installed::ModListJson {
        mods: vec![factorio::installed::ModListEntry {
            name: "base".to_string(),
            enabled: true,
            version: None,
        }],
    });

    let manifest = load_manifest(app_data_dir);
    let raw_installed = scan_installed_mods(mods_folder);

    // Group raw installed by name to detect duplicate root files
    let mut by_name: HashMap<String, Vec<factorio::installed::InstalledModDetails>> = HashMap::new();
    for item in raw_installed {
        by_name.entry(item.name.clone()).or_default().push(item);
    }

    // Scan stash directory
    let stash_root = stash_dir(mods_folder);
    let mut stashed_by_name: HashMap<String, Vec<StashedModVersion>> = HashMap::new();
    if stash_root.is_dir() {
        if let Ok(mod_dirs) = fs::read_dir(&stash_root) {
            for mod_entry in mod_dirs.flatten() {
                if mod_entry.path().is_dir() {
                    let mod_name = mod_entry.file_name().to_string_lossy().to_string();
                    if let Ok(ver_dirs) = fs::read_dir(mod_entry.path()) {
                        for ver_entry in ver_dirs.flatten() {
                            if ver_entry.path().is_dir() {
                                let ver_name = ver_entry.file_name().to_string_lossy().to_string();
                                if let Ok(files) = fs::read_dir(ver_entry.path()) {
                                    for file in files.flatten() {
                                        let p = file.path();
                                        if p.is_file() && p.extension().and_then(|e| e.to_str()) == Some("zip") {
                                            let meta = file.metadata().ok();
                                            stashed_by_name.entry(mod_name.clone()).or_default().push(
                                                StashedModVersion {
                                                    version: ver_name.clone(),
                                                    file_name: file.file_name().to_string_lossy().to_string(),
                                                    file_path: p.to_string_lossy().to_string(),
                                                    size_bytes: meta.map(|m| m.len()).unwrap_or(0),
                                                },
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Build enabled map
    let mod_list_entries = mod_list.mods.clone();
    let enabled_map: HashMap<String, bool> = mod_list
        .mods
        .into_iter()
        .map(|m| (m.name, m.enabled))
        .collect();

    let mut groups: Vec<InstalledModGroup> = Vec::new();
    let mut processed_names: HashSet<String> = HashSet::new();

    // 1. Mark Virtual Core Mods (base, space-age, quality, elevated-rails) as processed
    // so they are NEVER added to the manage view.
    for (v_id, _, _) in VIRTUAL_CORE_MODS {
        processed_names.insert(v_id.to_string());
    }

    // 2. Process scanned mods from root
    for (name, mut versions) in by_name {
        if processed_names.contains(&name) || is_virtual_mod(&name) {
            continue;
        }

        let mut health_issues = Vec::new();

        if versions.len() > 1 {
            versions.sort_by(|a, b| compare_versions(&b.version, &a.version));
            let duplicate_versions: Vec<String> = versions.iter().map(|v| v.version.clone()).collect();
            health_issues.push(HealthIssue {
                kind: "duplicate_root_zip".to_string(),
                message: format!(
                    "Multiple root files detected: ({}). Only one version should be active.",
                    duplicate_versions.join(", ")
                ),
            });
        }

        let primary = versions.remove(0);
        let enabled = *enabled_map.get(&name).unwrap_or(&false);
        let manifest_entry = manifest.mods.get(&name);
        let mut stashed = stashed_by_name.remove(&name).unwrap_or_default();

        // Any duplicate root versions beyond the primary should also be included in stashed_versions
        // so they are visible and manageable in the UI rather than silently lost.
        for extra in versions {
            let size_bytes = std::fs::metadata(&extra.file_path)
                .map(|m| m.len())
                .unwrap_or(0);
            stashed.push(StashedModVersion {
                version: extra.version,
                file_name: extra.file_name,
                file_path: extra.file_path,
                size_bytes,
            });
        }
        stashed.sort_by(|a, b| compare_versions(&b.version, &a.version));

        let pinned = manifest_entry.map(|e| e.pinned).unwrap_or(false);
        let pinned_policy = manifest_entry.and_then(|e| e.pinned_policy.clone());

        groups.push(InstalledModGroup {
            name: name.clone(),
            title: primary.title,
            author: primary.author,
            category: primary.category,
            thumbnail: primary.thumbnail,
            enabled,
            is_virtual: false,
            is_directory: primary.is_directory,
            active_version: primary.version,
            active_file_path: Some(primary.file_path),
            factorio_version: primary.factorio_version,
            stashed_versions: stashed,
            dependencies: primary.dependencies,
            has_update: false,
            latest_version: None,
            health_issues,
            pinned,
            pinned_policy,
        });
        processed_names.insert(name);
    }

    // 3. Process mods that only exist in stash (no active version in root)
    for (name, stashed) in stashed_by_name {
        if processed_names.contains(&name) || stashed.is_empty() {
            continue;
        }

        groups.push(InstalledModGroup {
            name: name.clone(),
            title: name.clone(),
            author: None,
            category: None,
            thumbnail: None,
            enabled: false,
            is_virtual: false,
            is_directory: false,
            active_version: "".to_string(),
            active_file_path: None,
            factorio_version: None,
            stashed_versions: stashed,
            dependencies: Vec::new(),
            has_update: false,
            latest_version: None,
            health_issues: vec![HealthIssue {
                kind: "not_installed".to_string(),
                message: "No active version in mods folder. Stashed versions available.".to_string(),
            }],
            pinned: false,
            pinned_policy: None,
        });
        processed_names.insert(name);
    }

    // 3.5. Process mods declared in mod-list.json that do NOT exist in root or stash
    for entry in mod_list_entries {
        if processed_names.contains(&entry.name) || is_virtual_mod(&entry.name) {
            continue;
        }

        groups.push(InstalledModGroup {
            name: entry.name.clone(),
            title: entry.name.clone(),
            author: None,
            category: None,
            thumbnail: None,
            enabled: entry.enabled,
            is_virtual: false,
            is_directory: false,
            active_version: "".to_string(),
            active_file_path: None,
            factorio_version: None,
            stashed_versions: Vec::new(),
            dependencies: Vec::new(),
            has_update: false,
            latest_version: None,
            health_issues: vec![HealthIssue {
                kind: "not_installed".to_string(),
                message: format!("Mod '{}' is configured in mod-list.json but is not installed on disk.", entry.name),
            }],
            pinned: false,
            pinned_policy: None,
        });
        processed_names.insert(entry.name);
    }

    // 4. Validate Dependency DAG Health
    let mut installed_status_map: HashMap<String, (bool, String)> = HashMap::new();

    // Virtual core mods and DLCs are always considered present to satisfy dependencies
    for (v_id, _, _) in VIRTUAL_CORE_MODS {
        let is_base = *v_id == "base";
        let enabled = if is_base { true } else { *enabled_map.get(*v_id).unwrap_or(&true) };
        installed_status_map.insert(v_id.to_string(), (enabled, "2.0.0".to_string()));
    }

    for g in &groups {
        installed_status_map.insert(g.name.clone(), (g.enabled, g.active_version.clone()));
    }

    for group in &mut groups {
        if !group.enabled || group.dependencies.is_empty() {
            continue;
        }

        let parsed = parse_dependencies(&Some(group.dependencies.clone()));

        // Check required dependencies
        for req in parsed.required {
            match installed_status_map.get(&req.id) {
                None => {
                    group.health_issues.push(HealthIssue {
                        kind: "missing_dep".to_string(),
                        message: format!("Missing required dependency: {}", req.id),
                    });
                }
                Some((is_enabled, _version)) if !*is_enabled => {
                    group.health_issues.push(HealthIssue {
                        kind: "disabled_dep".to_string(),
                        message: format!("Required dependency '{}' is disabled.", req.id),
                    });
                }
                _ => {}
            }
        }

        // Check incompatible conflicts
        for inc in parsed.incompatible {
            if let Some((is_enabled, _)) = installed_status_map.get(&inc.id) {
                if *is_enabled {
                    group.health_issues.push(HealthIssue {
                        kind: "incompatible_conflict".to_string(),
                        message: format!("Incompatible mod '{}' is currently enabled.", inc.id),
                    });
                }
            }
        }
    }

    groups.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));

    groups
}

pub fn register_and_enable_mod_group(
    mods_folder: &Path,
    app_data_dir: &Path,
    parent_name: &str,
    dependencies: &[String],
) -> Result<(), String> {
    // 1. Update installed-manifest.json
    let mut manifest = load_manifest(app_data_dir);

    let parent_entry = manifest
        .mods
        .entry(parent_name.to_string())
        .or_insert_with(|| ManifestModEntry {
            installed_at: Some(chrono::Utc::now().to_rfc3339()),
            pinned: false,
            pinned_policy: None,
            pinned_by_profile_id: None,
            active_version: None,
        });
    if parent_entry.installed_at.is_none() {
        parent_entry.installed_at = Some(chrono::Utc::now().to_rfc3339());
    }

    for dep_name in dependencies {
        if is_virtual_mod(dep_name) {
            continue;
        }
        let dep_entry = manifest
            .mods
            .entry(dep_name.clone())
            .or_insert_with(|| ManifestModEntry {
                installed_at: Some(chrono::Utc::now().to_rfc3339()),
                pinned: false,
                pinned_policy: None,
                pinned_by_profile_id: None,
                active_version: None,
            });
        if dep_entry.installed_at.is_none() {
            dep_entry.installed_at = Some(chrono::Utc::now().to_rfc3339());
        }
    }

    let _ = save_manifest(app_data_dir, &manifest);

    // 2. Enable in mod-list.json
    let mut mod_list = read_mod_list(mods_folder).unwrap_or_else(|_| factorio::installed::ModListJson {
        mods: vec![factorio::installed::ModListEntry {
            name: "base".to_string(),
            enabled: true,
            version: None,
        }],
    });

    let mut to_enable = vec![parent_name.to_string()];
    to_enable.extend(dependencies.iter().cloned());

    for mod_name in to_enable {
        if is_virtual_mod(&mod_name) {
            continue;
        }
        if let Some(entry) = mod_list.mods.iter_mut().find(|m| m.name == mod_name) {
            entry.enabled = true;
        } else {
            mod_list.mods.push(factorio::installed::ModListEntry {
                name: mod_name,
                enabled: true,
                version: None,
            });
        }
    }

    let backup_dir = app_data_dir.join("backups").join("mod-list");
    write_mod_list_atomic(mods_folder, mod_list, Some(&backup_dir))
        .map_err(|e| format!("Failed to update mod-list.json: {}", e))?;

    Ok(())
}

pub const EXCLUDED_CORE_MODS: &[&str] = &[
    "base",
    "space-age",
    "quality",
    "elevated-rails",
    "recycler",
];

pub fn is_excluded_core_mod(name: &str) -> bool {
    EXCLUDED_CORE_MODS.iter().any(|c| c.eq_ignore_ascii_case(name))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DepKind {
    Required,
    Optional,
    Incompatible,
}

pub fn parse_dep_string(raw: &str) -> Option<(String, DepKind, Option<String>)> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }

    let (prefix, rest) = if s.starts_with("(?)") {
        ("(?)", &s[3..])
    } else if s.starts_with("(+)") {
        ("(+)", &s[3..])
    } else if let Some(stripped) = s.strip_prefix('!') {
        ("!", stripped)
    } else if let Some(stripped) = s.strip_prefix('?') {
        ("?", stripped)
    } else if let Some(stripped) = s.strip_prefix('~') {
        ("~", stripped)
    } else if let Some(stripped) = s.strip_prefix('+') {
        ("+", stripped)
    } else {
        ("", s)
    };

    let rest = rest.trim();
    let (name, constraint) = if let Some(idx) = rest.find(|c: char| c == '>' || c == '<' || c == '=' || c == '!') {
        (rest[..idx].trim(), Some(rest[idx..].trim().to_string()))
    } else {
        (rest, None)
    };

    if name.is_empty() || is_excluded_core_mod(name) {
        return None;
    }

    let kind = match prefix {
        "!" => DepKind::Incompatible,
        "?" | "(?)" | "+" | "(+)" | "~" => DepKind::Optional,
        _ => DepKind::Required,
    };

    Some((name.to_string(), kind, constraint))
}

// --- Helper functions for compute_installed_mod_graph ---

fn build_dep_dag(
    mod_map: &HashMap<String, &InstalledModGroup>,
) -> (HashMap<String, Vec<String>>, HashMap<(String, String), String>) {
    let mut parents_of: HashMap<String, Vec<String>> = HashMap::new();
    let mut dep_constraints: HashMap<(String, String), String> = HashMap::new();

    for (name, item) in mod_map {
        for dep_str in &item.dependencies {
            if let Some((target_id, kind, constraint)) = parse_dep_string(dep_str) {
                if let Some(ref c) = constraint {
                    dep_constraints.insert((name.clone(), target_id.clone()), c.clone());
                }
                if mod_map.contains_key(&target_id) && kind == DepKind::Required {
                    let list = parents_of.entry(target_id).or_default();
                    if !list.contains(name) {
                        list.push(name.clone());
                    }
                }
            }
        }
    }
    (parents_of, dep_constraints)
}

fn classify_roots(
    mod_map: &HashMap<String, &InstalledModGroup>,
    parents_of: &HashMap<String, Vec<String>>,
) -> (HashSet<String>, HashMap<String, String>) {
    let mut roots = HashSet::new();
    let mut single_parent_mods = HashMap::new();

    for name in mod_map.keys() {
        let parent_count = parents_of.get(name).map(|p| p.len()).unwrap_or(0);
        if parent_count == 1 {
            let single_p = parents_of.get(name).unwrap()[0].clone();
            single_parent_mods.insert(name.clone(), single_p);
        } else {
            // 0 parents or >= 2 parents: top-level root card
            roots.insert(name.clone());
        }
    }

    (roots, single_parent_mods)
}

fn assign_groups(
    mod_map: &HashMap<String, &InstalledModGroup>,
    mut roots: HashSet<String>,
    single_parent_mods: &HashMap<String, String>,
) -> (HashMap<String, String>, HashMap<String, String>) {
    let mut mod_to_group = HashMap::new();
    let mut tags = HashMap::new();

    for r in &roots {
        mod_to_group.insert(r.clone(), r.clone());
    }

    for (name, _) in single_parent_mods {
        if mod_to_group.contains_key(name) {
            continue;
        }

        let mut path = vec![name.clone()];
        let mut curr = name.clone();
        let mut visited = HashSet::new();
        visited.insert(curr.clone());

        let mut target_group = None;

        while let Some(parent) = single_parent_mods.get(&curr) {
            if roots.contains(parent) {
                target_group = Some(parent.clone());
                break;
            } else if let Some(grp) = mod_to_group.get(parent) {
                target_group = Some(grp.clone());
                break;
            } else if visited.contains(parent) {
                break;
            } else {
                visited.insert(parent.clone());
                path.push(parent.clone());
                curr = parent.clone();
            }
        }

        if let Some(grp) = target_group {
            for node in path {
                mod_to_group.insert(node, grp.clone());
            }
        } else {
            path.sort();
            let cycle_root = path[0].clone();
            roots.insert(cycle_root.clone());
            tags.insert(cycle_root.clone(), "cycle".to_string());
            for node in path {
                mod_to_group.insert(node, cycle_root.clone());
            }
        }
    }

    for name in mod_map.keys() {
        mod_to_group.entry(name.clone()).or_insert_with(|| name.clone());
    }

    (mod_to_group, tags)
}

fn collect_references(
    mod_map: &HashMap<String, &InstalledModGroup>,
    mod_to_group: &HashMap<String, String>,
) -> (HashMap<String, Vec<ModReference>>, HashMap<String, Vec<ModReference>>) {
    let mut mod_references: HashMap<String, Vec<ModReference>> = HashMap::new();
    let mut group_references: HashMap<String, Vec<ModReference>> = HashMap::new();

    for (name, item) in mod_map {
        let current_group = mod_to_group.get(name).cloned().unwrap_or_else(|| name.clone());

        for dep_str in &item.dependencies {
            if let Some((target_id, kind, constraint)) = parse_dep_string(dep_str) {
                if kind != DepKind::Required {
                    continue;
                }
                if let Some(target_item) = mod_map.get(&target_id) {
                    let target_group = mod_to_group.get(&target_id).cloned().unwrap_or_else(|| target_id.clone());

                    if target_group != current_group {
                        let req_ref = ModReference {
                            kind: ReferenceKind::Requires,
                            target_name: target_group.clone(),
                            constraint: constraint.clone(),
                            target_title: mod_map.get(&target_group).map(|m| m.title.clone()),
                            source_mod: Some(name.clone()),
                            installed_version: Some(target_item.active_version.clone()),
                        };
                        mod_references.entry(name.clone()).or_default().push(req_ref.clone());
                        group_references.entry(current_group.clone()).or_default().push(req_ref);

                        let req_by_ref = ModReference {
                            kind: ReferenceKind::RequiredBy,
                            target_name: current_group.clone(),
                            constraint: constraint.clone(),
                            target_title: mod_map.get(&current_group).map(|m| m.title.clone()),
                            source_mod: Some(target_group.clone()),
                            installed_version: mod_map.get(&current_group).map(|m| m.active_version.clone()),
                        };
                        group_references.entry(target_group.clone()).or_default().push(req_by_ref.clone());
                        if let Some(root_item) = mod_map.get(&target_group) {
                            mod_references.entry(root_item.name.clone()).or_default().push(req_by_ref);
                        }
                    }
                }
            }
        }
    }

    (mod_references, group_references)
}

fn compute_aggregate(enabled: usize, total: usize) -> GroupAggregate {
    let state = if enabled == total && total > 0 {
        AggregateState::All
    } else if enabled == 0 {
        AggregateState::None
    } else {
        AggregateState::Some
    };
    GroupAggregate {
        enabled,
        total,
        state,
    }
}

fn build_root_group(
    root_name: &str,
    child_names: &[String],
    mod_map: &HashMap<String, &InstalledModGroup>,
    parents_of: &HashMap<String, Vec<String>>,
    dep_constraints: &HashMap<(String, String), String>,
    tags: &HashMap<String, String>,
    mut grp_refs: Vec<ModReference>,
) -> ModGroupGraph {
    let root_mod = mod_map.get(root_name).unwrap();
    let mut child_rows: Vec<ChildNode> = Vec::new();
    let mut group_health: Vec<HealthIssue> = root_mod.health_issues.clone();

    // 1. Build parent-child tree hierarchy within group
    let mut tree_children: HashMap<String, Vec<String>> = HashMap::new();
    for child_name in child_names {
        let mut immediate_parent: Option<String> = None;
        for other_child in child_names {
            if other_child != child_name {
                if let Some(reqs) = parents_of.get(child_name) {
                    if reqs.contains(other_child) {
                        immediate_parent = Some(other_child.clone());
                        break;
                    }
                }
            }
        }
        let parent = immediate_parent.unwrap_or_else(|| root_name.to_string());
        tree_children.entry(parent).or_default().push(child_name.clone());
    }

    let mut visited_children = HashSet::new();

    fn visit_node(
        parent_id: &str,
        current_depth: usize,
        tree_children: &HashMap<String, Vec<String>>,
        mod_map: &HashMap<String, &InstalledModGroup>,
        dep_constraints: &HashMap<(String, String), String>,
        tags: &HashMap<String, String>,
        root_mod: &InstalledModGroup,
        child_rows: &mut Vec<ChildNode>,
        group_health: &mut Vec<HealthIssue>,
        visited_children: &mut HashSet<String>,
    ) {
        if let Some(children) = tree_children.get(parent_id) {
            let mut sorted = children.clone();
            sorted.sort_by(|a, b| {
                let title_a = mod_map.get(a).map(|m| m.title.as_str()).unwrap_or(a);
                let title_b = mod_map.get(b).map(|m| m.title.as_str()).unwrap_or(b);
                title_a.to_lowercase().cmp(&title_b.to_lowercase())
            });

            for child_name in sorted {
                if !visited_children.insert(child_name.clone()) {
                    continue;
                }

                let child_mod = match mod_map.get(&child_name) {
                    Some(m) => m,
                    None => continue,
                };

                let via = if parent_id != root_mod.name {
                    mod_map.get(parent_id).map(|p| p.title.clone())
                } else {
                    None
                };

                let constraint = dep_constraints
                    .get(&(parent_id.to_string(), child_name.clone()))
                    .or_else(|| dep_constraints.get(&(root_mod.name.clone(), child_name.clone())))
                    .cloned();

                let mut child_mod_data = (*child_mod).clone();

                if root_mod.enabled && !child_mod.enabled {
                    let disabled_issue = HealthIssue {
                        kind: "disabled_dep".to_string(),
                        message: format!("Required dependency '{}' is disabled.", child_mod.title),
                    };
                    if !group_health.iter().any(|h| h.message == disabled_issue.message) {
                        group_health.push(disabled_issue);
                    }
                }

                if let Some(ref c) = constraint {
                    let parts: Vec<&str> = c.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let ineq = parts[0];
                        let req_ver = parts[1];
                        if !parser::parser::satisfies_constraint(&child_mod.active_version, ineq, req_ver) {
                            let constraint_issue = HealthIssue {
                                kind: "unmet_constraint".to_string(),
                                message: format!(
                                    "Unmet constraint for '{}': requires {} {}, installed v{}",
                                    child_mod.title, ineq, req_ver, child_mod.active_version
                                ),
                            };
                            if !child_mod_data.health_issues.iter().any(|h| h.message == constraint_issue.message) {
                                child_mod_data.health_issues.push(constraint_issue.clone());
                            }
                            if !group_health.iter().any(|h| h.message == constraint_issue.message) {
                                group_health.push(constraint_issue);
                            }
                        }
                    }
                }

                for issue in &child_mod.health_issues {
                    if !group_health.iter().any(|h| h.message == issue.message) {
                        group_health.push(issue.clone());
                    }
                }

                child_rows.push(ChildNode {
                    mod_data: child_mod_data,
                    depth: current_depth,
                    via,
                    tag: tags.get(&child_name).cloned(),
                    missing: false,
                    constraint,
                    references: Vec::new(),
                });

                visit_node(
                    &child_name,
                    current_depth + 1,
                    tree_children,
                    mod_map,
                    dep_constraints,
                    tags,
                    root_mod,
                    child_rows,
                    group_health,
                    visited_children,
                );
            }
        }
    }

    visit_node(
        root_name,
        1,
        &tree_children,
        mod_map,
        dep_constraints,
        tags,
        root_mod,
        &mut child_rows,
        &mut group_health,
        &mut visited_children,
    );

    // Fallback for unvisited cycle children
    for child_name in child_names {
        if visited_children.insert(child_name.clone()) {
            if let Some(child_mod) = mod_map.get(child_name) {
                child_rows.push(ChildNode {
                    mod_data: (*child_mod).clone(),
                    depth: 1,
                    via: None,
                    tag: tags.get(child_name).cloned(),
                    missing: false,
                    constraint: None,
                    references: Vec::new(),
                });
            }
        }
    }

    // Check for missing required dependencies
    let mut missing_seen = HashSet::new();
    let mut all_members = vec![root_mod];
    for c in child_names {
        if let Some(m) = mod_map.get(c) {
            all_members.push(m);
        }
    }

    for member in all_members {
        for dep_str in &member.dependencies {
            if let Some((target_id, kind, constraint)) = parse_dep_string(dep_str) {
                if kind == DepKind::Required && !mod_map.contains_key(&target_id) && missing_seen.insert(target_id.clone()) {
                    let missing_issue = HealthIssue {
                        kind: "missing_dep".to_string(),
                        message: format!("Missing required dependency: {}", target_id),
                    };
                    group_health.push(missing_issue.clone());

                    child_rows.push(ChildNode {
                        mod_data: InstalledModGroup {
                            name: target_id.clone(),
                            title: target_id.clone(),
                            author: None,
                            category: None,
                            thumbnail: None,
                            enabled: false,
                            is_virtual: false,
                            is_directory: false,
                            active_version: String::new(),
                            active_file_path: None,
                            factorio_version: None,
                            stashed_versions: Vec::new(),
                            dependencies: Vec::new(),
                            has_update: false,
                            latest_version: None,
                            health_issues: vec![missing_issue],
                            pinned: false,
                            pinned_policy: None,
                        },
                        depth: if member.name != root_name { 2 } else { 1 },
                        via: if member.name != root_name { Some(member.title.clone()) } else { None },
                        tag: None,
                        missing: true,
                        constraint,
                        references: Vec::new(),
                    });
                }
            }
        }
    }

    // Deduplicate references
    let mut seen_refs = HashSet::new();
    grp_refs.retain(|r| seen_refs.insert((r.kind.clone(), r.target_name.clone())));

    let enabled_count = (if root_mod.enabled { 1 } else { 0 })
        + child_rows.iter().filter(|c| !c.missing && c.mod_data.enabled).count();
    let total_count = 1 + child_rows.iter().filter(|c| !c.missing).count();
    let update_count = (if root_mod.has_update { 1 } else { 0 })
        + child_rows.iter().filter(|c| !c.missing && c.mod_data.has_update).count();

    ModGroupGraph {
        id: root_name.to_string(),
        kind: if child_rows.is_empty() { GroupKind::Standalone } else { GroupKind::Group },
        root: Some((*root_mod).clone()),
        children: child_rows,
        references: grp_refs,
        aggregate: compute_aggregate(enabled_count, total_count),
        health: group_health,
        update_count,
        tag: tags.get(root_name).cloned(),
    }
}

/// Pure Rust function implementing the straightforward mod grouping algorithm:
/// 1. Only required dependencies determine grouping edges between installed mods.
/// 2. If a mod has no parent, or has >= 2 parents, it is a top-level root node with reference pills.
/// 3. If a mod has strictly 1 parent, it is a subnode under that parent.
pub fn compute_installed_mod_graph(
    installed: &[InstalledModGroup],
    _manifest: &InstalledManifest,
) -> Vec<ModGroupGraph> {
    let mod_map: HashMap<String, &InstalledModGroup> = installed
        .iter()
        .filter(|m| !is_excluded_core_mod(&m.name))
        .map(|m| (m.name.clone(), m))
        .collect();

    if mod_map.is_empty() {
        return Vec::new();
    }

    // 1. Build parent/child maps based ONLY on required dependencies
    let (parents_of, dep_constraints) = build_dep_dag(&mod_map);

    // 2. Identify initial roots (0 or >= 2 parents) and single-parent mods
    let (roots, single_parent_mods) = classify_roots(&mod_map, &parents_of);

    // 3. Resolve single-parent chains to their ancestor root, and detect cycles
    let (mod_to_group, tags) = assign_groups(&mod_map, roots, &single_parent_mods);

    // 4. Compute cross-group references (pill links)
    let (_mod_references, mut group_references) = collect_references(&mod_map, &mod_to_group);

    // 5. Group children
    let mut root_groups: HashMap<String, Vec<String>> = HashMap::new();

    for (name, grp) in &mod_to_group {
        if name != grp {
            root_groups.entry(grp.clone()).or_default().push(name.clone());
        } else {
            root_groups.entry(name.clone()).or_default();
        }
    }

    // 6. Build final ModGroupGraph items
    let mut result: Vec<ModGroupGraph> = Vec::new();

    let mut sorted_root_names: Vec<String> = root_groups.keys().cloned().collect();
    sorted_root_names.sort_by(|a, b| {
        let title_a = mod_map.get(a).map(|m| m.title.as_str()).unwrap_or(a);
        let title_b = mod_map.get(b).map(|m| m.title.as_str()).unwrap_or(b);
        title_a.to_lowercase().cmp(&title_b.to_lowercase())
    });

    for root_name in sorted_root_names {
        let child_names = root_groups.remove(&root_name).unwrap_or_default();
        let grp_refs = group_references.remove(&root_name).unwrap_or_default();
        result.push(build_root_group(
            &root_name,
            &child_names,
            &mod_map,
            &parents_of,
            &dep_constraints,
            &tags,
            grp_refs,
        ));
    }

    result
}

pub fn get_installed_mod_groups_graph(
    mods_folder: &Path,
    app_data_dir: &Path,
) -> Vec<ModGroupGraph> {
    let installed = get_installed_mod_groups(mods_folder, app_data_dir);
    let manifest = load_manifest(app_data_dir);
    compute_installed_mod_graph(&installed, &manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_mod(name: &str, title: &str, deps: Vec<&str>) -> InstalledModGroup {
        InstalledModGroup {
            name: name.to_string(),
            title: title.to_string(),
            author: Some("TestAuthor".to_string()),
            category: Some("Content".to_string()),
            thumbnail: None,
            enabled: true,
            is_virtual: false,
            is_directory: false,
            active_version: "1.0.0".to_string(),
            active_file_path: Some(format!("/mods/{}.zip", name)),
            factorio_version: Some("2.0".to_string()),
            stashed_versions: Vec::new(),
            dependencies: deps.into_iter().map(|s| s.to_string()).collect(),
            has_update: false,
            latest_version: None,
            health_issues: Vec::new(),
            pinned: false,
            pinned_policy: None,
        }
    }

    #[test]
    fn test_single_owner_nesting() {
        let parent = make_test_mod("space-exploration", "Space Exploration", vec!["alien-biomes"]);
        let child = make_test_mod("alien-biomes", "Alien Biomes", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[parent, child], &manifest);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].id, "space-exploration");
        assert_eq!(graph[0].children.len(), 1);
        assert_eq!(graph[0].children[0].mod_data.name, "alien-biomes");
        assert_eq!(graph[0].children[0].depth, 1);
        assert_eq!(graph[0].children[0].via, None);
    }

    #[test]
    fn test_shared_dependency_becomes_standalone_root() {
        let mod_a = make_test_mod("mod-a", "Mod A", vec!["flib"]);
        let mod_b = make_test_mod("mod-b", "Mod B", vec!["flib"]);
        let flib = make_test_mod("flib", "FLib Library", vec![]);

        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, mod_b, flib], &manifest);
        // flib is required by both mod-a and mod-b (>=2 parents), so it is a standalone root group
        let flib_g = graph.iter().find(|g| g.id == "flib");
        assert!(flib_g.is_some());
        let flib_g = flib_g.unwrap();
        assert_eq!(flib_g.kind, GroupKind::Standalone);
        assert!(flib_g.references.iter().any(|r| r.kind == ReferenceKind::RequiredBy));
    }

    #[test]
    fn test_transitive_flattening_with_via() {
        let root = make_test_mod("overhaul", "Big Overhaul", vec!["dep-a"]);
        let dep_a = make_test_mod("dep-a", "Dependency A", vec!["dep-b"]);
        let dep_b = make_test_mod("dep-b", "Dependency B", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[root, dep_a, dep_b], &manifest);
        assert_eq!(graph.len(), 1);
        let children = &graph[0].children;
        assert_eq!(children.len(), 2);
        let b_row = children.iter().find(|m| m.mod_data.name == "dep-b").unwrap();
        assert_eq!(b_row.depth, 2);
        assert_eq!(b_row.via, Some("Dependency A".to_string()));
    }

    #[test]
    fn test_orphan_promoted_to_unused_root() {
        let orphan = make_test_mod("orphan-lib", "Orphan Library", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[orphan], &manifest);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].id, "orphan-lib");
    }

    #[test]
    fn test_cycle_guards_and_determinism() {
        let mod_x = make_test_mod("cycle-x", "Cycle X", vec!["cycle-y"]);
        let mod_y = make_test_mod("cycle-y", "Cycle Y", vec!["cycle-x"]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_x, mod_y], &manifest);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].id, "cycle-x"); // deterministically picked alphabetically
        assert_eq!(graph[0].tag, Some("cycle".to_string()));
        assert_eq!(graph[0].children.len(), 1);
        assert_eq!(graph[0].children[0].mod_data.name, "cycle-y");
    }

    #[test]
    fn test_excluded_core_mods() {
        let mod_a = make_test_mod("my-mod", "My Mod", vec!["base >= 2.0", "space-age", "real-dep"]);
        let real_dep = make_test_mod("real-dep", "Real Dep", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, real_dep], &manifest);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].children.len(), 1);
        assert_eq!(graph[0].children[0].mod_data.name, "real-dep");
    }

    #[test]
    fn test_missing_required_dependency_placeholder() {
        let parent = make_test_mod("alien-biomes", "Alien Biomes", vec!["alien-biomes-graphics"]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[parent], &manifest);
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0].children.len(), 1);
        let missing_child = &graph[0].children[0];
        assert_eq!(missing_child.mod_data.name, "alien-biomes-graphics");
        assert!(missing_child.missing);
        assert!(graph[0].health.iter().any(|h| h.kind == "missing_dep"));
        // Missing child shouldn't count towards aggregate
        assert_eq!(graph[0].aggregate.total, 1);
    }

    #[test]
    fn test_single_parent_nesting() {
        let mod_a = make_test_mod("mod-a", "Mod A", vec!["mod-b"]);
        let mod_b = make_test_mod("mod-b", "Mod B", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, mod_b], &manifest);
        // Single parent scenario: mod_b has parent mod_a -> subnode under mod_a
        assert_eq!(graph.len(), 1);
        let a_group = graph.iter().find(|g| g.id == "mod-a").unwrap();
        assert_eq!(a_group.children.len(), 1);
        assert_eq!(a_group.children[0].mod_data.name, "mod-b");
    }

    #[test]
    fn test_two_independent_roots() {
        let mod_a = make_test_mod("mod-a", "Mod A", vec![]);
        let mod_b = make_test_mod("mod-b", "Mod B", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, mod_b], &manifest);
        assert_eq!(graph.len(), 2);
    }

    #[test]
    fn test_shared_dependency_stays_as_standalone_root() {
        let mod_a = make_test_mod("mod-a", "Mod A", vec!["flib"]);
        let mod_b = make_test_mod("mod-b", "Mod B", vec!["flib"]);
        let flib = make_test_mod("flib", "FLib Library", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, mod_b, flib], &manifest);
        assert!(graph.iter().all(|g| g.id != "shared-libraries"));
        let flib_g = graph.iter().find(|g| g.id == "flib").unwrap();
        assert_eq!(flib_g.kind, GroupKind::Standalone);
        assert_eq!(flib_g.references.len(), 2);
    }

    #[test]
    fn test_optional_dependency_no_references() {
        let mod_a = make_test_mod("mod-a", "Mod A", vec!["? mod-b"]);
        let mod_b = make_test_mod("mod-b", "Mod B", vec![]);
        let manifest = InstalledManifest::default();

        let graph = compute_installed_mod_graph(&[mod_a, mod_b], &manifest);
        let a_group = graph.iter().find(|g| g.id == "mod-a").unwrap();
        let b_group = graph.iter().find(|g| g.id == "mod-b").unwrap();

        // Optional dependencies must NOT create Requires or RequiredBy references
        assert!(a_group.references.is_empty());
        assert!(b_group.references.is_empty());
    }

    #[test]
    fn test_user_requested_grouping_scenario() {
        // 1. Krastorio 2: Required dep: flib, K2assets, K2MenuSimulation, ChangeInserterDropLane
        let k2 = make_test_mod("Krastorio2", "Krastorio 2", vec!["flib", "K2assets", "K2MenuSimulation", "ChangeInserterDropLane"]);
        // 2. ChangeInserterDropLane: Required dep: flib
        let lane = make_test_mod("ChangeInserterDropLane", "Change Inserter Drop Lane", vec!["flib"]);
        let k2assets = make_test_mod("K2assets", "K2 Assets", vec![]);
        let k2sim = make_test_mod("K2MenuSimulation", "K2 Menu Simulation", vec![]);
        let flib = make_test_mod("flib", "FLib", vec![]);

        // 3. K2Spaced Out: required is K2SO Assets, Krastorio 2
        let k2so = make_test_mod("K2SpacedOut", "K2 Spaced Out", vec!["K2SOAssets", "Krastorio2"]);
        let k2so_assets = make_test_mod("K2SOAssets", "K2SO Assets", vec![]);

        // 4. BridgeTechnologies: Optional: 123menuhelper, Recommend: FlatWorld
        let bridge = make_test_mod("BridgeTechnologies", "Bridge Technologies", vec!["? 123menuhelper", "~ FlatWorld"]);
        let helper = make_test_mod("123menuhelper", "123 Menu Helper", vec![]);
        let flat = make_test_mod("FlatWorld", "Flat World", vec![]);

        // 5. Alien Biomes: required AlienBiomesGraphics
        let alien = make_test_mod("AlienBiomes", "Alien Biomes", vec!["AlienBiomesGraphics"]);
        let alien_gfx = make_test_mod("AlienBiomesGraphics", "Alien Biomes Graphics", vec![]);

        let manifest = InstalledManifest::default();

        let all_mods = vec![
            k2, lane, k2assets, k2sim, flib,
            k2so, k2so_assets,
            bridge, helper, flat,
            alien, alien_gfx,
        ];

        let graph = compute_installed_mod_graph(&all_mods, &manifest);

        // Check BridgeTechnologies, 123menuhelper, FlatWorld are standalone roots!
        let bridge_g = graph.iter().find(|g| g.id == "BridgeTechnologies").unwrap();
        assert_eq!(bridge_g.kind, GroupKind::Standalone);
        assert_eq!(bridge_g.children.len(), 0);

        let helper_g = graph.iter().find(|g| g.id == "123menuhelper").unwrap();
        assert_eq!(helper_g.kind, GroupKind::Standalone);

        let flat_g = graph.iter().find(|g| g.id == "FlatWorld").unwrap();
        assert_eq!(flat_g.kind, GroupKind::Standalone);

        // Check Alien Biomes
        let alien_g = graph.iter().find(|g| g.id == "AlienBiomes").unwrap();
        assert_eq!(alien_g.children.len(), 1);
        assert_eq!(alien_g.children[0].mod_data.name, "AlienBiomesGraphics");

        // Check K2Spaced Out: has all 5 transitive subnodes
        let k2so_g = graph.iter().find(|g| g.id == "K2SpacedOut").unwrap();
        assert_eq!(k2so_g.children.len(), 5);
        assert!(k2so_g.children.iter().any(|c| c.mod_data.name == "K2SOAssets"));
        assert!(k2so_g.children.iter().any(|c| c.mod_data.name == "Krastorio2"));

        // Check flib: required by Krastorio2 and ChangeInserterDropLane -> Standalone root with references
        assert!(graph.iter().all(|g| g.id != "shared-libraries"));
        let flib_g = graph.iter().find(|g| g.id == "flib").unwrap();
        assert_eq!(flib_g.kind, GroupKind::Standalone);
        assert!(flib_g.references.iter().any(|r| r.kind == ReferenceKind::RequiredBy));
    }
}
