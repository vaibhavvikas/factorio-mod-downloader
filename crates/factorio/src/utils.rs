/// True when running under CI (GitHub Actions sets `CI=true`).
/// Use this to skip network-dependent integration tests in pipelines.
pub fn is_ci() -> bool {
    matches!(std::env::var("CI").ok().as_deref(), Some("true") | Some("1"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ci() {
        // This test just verifies the function compiles and returns a bool.
        let _ = is_ci();
    }
}
