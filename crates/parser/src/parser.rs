use crate::models::{Dependencies, Dependency};

const IGNORED_MOD_IDS: &[&str] = &["base", "space-age", "quality"];

pub fn parse_dependencies(dependencies: &Option<Vec<String>>) -> Dependencies {
    let reg = regex::Regex::new(
        r"^(?P<prefix>\?|\(\?\)|!|~|\+|\(\+\))?\s*(?P<id>[%\w\s-]+)\s*((?P<ineq>=>|==|=|<=|>=|<|>)\s*(?P<version>\d+\.\d+\.\d+|\d+\.\d+))?$"
    )
    .unwrap();

    let mut result = Dependencies::default();

    for dep in dependencies.as_deref().unwrap_or(&[]) {
        let Some(caps) = reg.captures(dep) else {
            eprintln!("Failed to parse the dependency: {:?}", dep);
            continue;
        };

        let prefix = caps.name("prefix").map_or("", |m| m.as_str());
        let id = caps.name("id").map(|m| m.as_str().trim()).unwrap();
        let ineq = caps.name("ineq").map_or("", |m| m.as_str());
        let version = caps.name("version").map_or("", |m| m.as_str());

        if IGNORED_MOD_IDS.contains(&id) {
            continue;
        }

        let dep = Dependency {
            id: id.to_string(),
            ineq: if ineq == "==" {
                "=".to_string()
            } else {
                ineq.to_string()
            },
            version: version.to_string(),
        };

        match prefix {
            "" => result.required.push(dep),
            "?" | "(?)" => result.optional.push(dep),
            "+" | "(+)" => result.recommended.push(dep),
            "!" => result.incompatible.push(dep),
            _ => {}
        }
    }

    result
}

/// Checks if a version string satisfies an inequality constraint (e.g. "1.4.1", ">=", "1.2.0" -> true)
pub fn satisfies_constraint(version: &str, ineq: &str, target_version: &str) -> bool {
    if ineq.is_empty() || target_version.is_empty() {
        return true;
    }

    let parse_ver = |v: &str| -> (u64, u64, u64) {
        let parts: Vec<u64> = v.split('.').filter_map(|p| p.parse().ok()).collect();
        (
            *parts.get(0).unwrap_or(&0),
            *parts.get(1).unwrap_or(&0),
            *parts.get(2).unwrap_or(&0),
        )
    };

    let ver_tuple = parse_ver(version);
    let target_tuple = parse_ver(target_version);

    match ineq {
        ">=" => ver_tuple >= target_tuple,
        ">" => ver_tuple > target_tuple,
        "<=" => ver_tuple <= target_tuple,
        "<" => ver_tuple < target_tuple,
        "=" | "==" => ver_tuple == target_tuple,
        _ => true,
    }
}
