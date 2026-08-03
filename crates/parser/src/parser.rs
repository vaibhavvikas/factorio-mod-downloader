use crate::models::{Dependencies, Dependency};

const IGNORED_MOD_IDS: &[&str] = &["base", "space-age", "quality", "elevated-rails", "recycler"];

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

        if IGNORED_MOD_IDS.contains(&id.to_lowercase().as_str()) {
            continue;
        }

        let dep = Dependency {
            id: id.to_string(),
            ineq: if ineq == "==" {
                "=".to_string()
            } else if ineq == "=>" {
                ">=".to_string()
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
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
            parts.get(2).copied().unwrap_or(0),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dependencies_all_operators() {
        let deps = vec![
            "flib >= 0.12.0".to_string(),
            "? Krastorio2 >= 2.0.0".to_string(),
            "+ stdlib <= 1.5.0".to_string(),
            "! bad_mod = 1.0.0".to_string(),
            "other_mod > 0.5.0".to_string(),
            "? another_mod < 3.0.0".to_string(),
            "eq_mod == 2.1.0".to_string(),
        ];

        let parsed = parse_dependencies(&Some(deps));

        assert_eq!(parsed.required.len(), 3);
        assert_eq!(parsed.required[0].ineq, ">=");
        assert_eq!(parsed.required[1].ineq, ">");
        assert_eq!(parsed.required[2].ineq, "=");

        assert_eq!(parsed.optional.len(), 2);
        assert_eq!(parsed.optional[0].ineq, ">=");
        assert_eq!(parsed.optional[1].ineq, "<");

        assert_eq!(parsed.recommended.len(), 1);
        assert_eq!(parsed.recommended[0].ineq, "<=");

        assert_eq!(parsed.incompatible.len(), 1);
        assert_eq!(parsed.incompatible[0].ineq, "=");
    }

    #[test]
    fn test_satisfies_constraint() {
        assert!(satisfies_constraint("2.0.0", ">=", "1.5.0"));
        assert!(satisfies_constraint("2.0.0", "=", "2.0.0"));
        assert!(satisfies_constraint("1.0.0", "<=", "2.0.0"));
        assert!(satisfies_constraint("2.5.0", ">", "2.0.0"));
        assert!(satisfies_constraint("1.9.0", "<", "2.0.0"));
        assert!(!satisfies_constraint("1.0.0", ">=", "2.0.0"));
    }
}
