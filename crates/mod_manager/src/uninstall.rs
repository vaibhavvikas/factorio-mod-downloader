use crate::grouping::stash_dir;
use crate::manifest::{load_manifest, save_manifest};
use crate::models::UninstallPreview;
use crate::process::is_factorio_running;
use factorio::installed::{delete_mod_file, is_virtual_mod, read_mod_list, scan_installed_mods, write_mod_list_atomic};
use parser::parser::parse_dependencies;
use std::collections::{HashMap, HashSet};
use std::path::Path;

/// Preview which dependencies will be cascade-removed and which will be kept.
pub fn preview_uninstall(
    mods_folder: &Path,
    _app_data_dir: &Path,
    targets: &[String],
) -> UninstallPreview {
    let installed = scan_installed_mods(mods_folder);

    let target_set: HashSet<&str> = targets.iter().map(|s| s.as_str()).collect();

    // Map: ModName -> Set of required dependencies
    let mut forward_deps: HashMap<String, HashSet<String>> = HashMap::new();
    for m in &installed {
        let parsed = parse_dependencies(&Some(m.dependencies.clone()));
        let reqs: HashSet<String> = parsed.required.into_iter().map(|d| d.id).collect();
        forward_deps.insert(m.name.clone(), reqs);
    }

    // Compute reverse dependencies: Dep -> Set of parents that require it
    let mut reverse_deps: HashMap<String, HashSet<String>> = HashMap::new();
    for (parent, deps) in &forward_deps {
        for dep in deps {
            reverse_deps.entry(dep.clone()).or_default().insert(parent.clone());
        }
    }

    let mut cascade_removals = HashSet::new();
    let mut kept_dependencies = HashSet::new();

    // Trace dependencies of target mods
    for target in targets {
        if let Some(deps) = forward_deps.get(target) {
            for dep in deps {
                if target_set.contains(dep.as_str()) || is_virtual_mod(dep) {
                    continue;
                }

                let parents = reverse_deps.get(dep);
                let other_parents_count = parents
                    .map(|p_set| p_set.iter().filter(|p| !target_set.contains(p.as_str())).count())
                    .unwrap_or(0);

                if other_parents_count == 0 {
                    cascade_removals.insert(dep.clone());
                } else {
                    kept_dependencies.insert(dep.clone());
                }
            }
        }
    }

    UninstallPreview {
        targets: targets.to_vec(),
        cascade_removals: cascade_removals.into_iter().collect(),
        kept_dependencies: kept_dependencies.into_iter().collect(),
    }
}

/// Execute uninstall for selected mods and cascading dependencies.
pub fn execute_uninstall(
    mods_folder: &Path,
    app_data_dir: &Path,
    mods_to_remove: &[String],
    delete_stashed_too: bool,
) -> Result<(), String> {
    if is_factorio_running() {
        return Err("Cannot uninstall mods while Factorio is running. Please close the game first.".to_string());
    }

    let remove_set: HashSet<&str> = mods_to_remove.iter().map(|s| s.as_str()).collect();

    // 1. Update mod-list.json
    if let Ok(mut mod_list) = read_mod_list(mods_folder) {
        mod_list.mods.retain(|m| !remove_set.contains(m.name.as_str()));
        let backup_dir = app_data_dir.join("backups").join("mod-list");
        let _ = write_mod_list_atomic(mods_folder, mod_list, Some(&backup_dir));
    }

    // 2. Delete root mod files
    let installed = scan_installed_mods(mods_folder);
    for m in installed {
        if remove_set.contains(m.name.as_str()) {
            let p = Path::new(&m.file_path);
            let _ = delete_mod_file(p);
        }
    }

    // 3. Optional stash cleanup
    if delete_stashed_too {
        let stash_root = stash_dir(mods_folder);
        for name in mods_to_remove {
            let dir = stash_root.join(name);
            if dir.is_dir() {
                let _ = std::fs::remove_dir_all(&dir);
            }
        }
    }

    // 4. Update manifest
    let mut manifest = load_manifest(app_data_dir);
    for name in mods_to_remove {
        manifest.mods.remove(name);
    }
    let _ = save_manifest(app_data_dir, &manifest);

    Ok(())
}
