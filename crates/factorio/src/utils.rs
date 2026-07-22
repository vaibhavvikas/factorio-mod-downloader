use rand::RngExt;

pub fn generate_rand() -> String {
    let mut rng = rand::rng();

    let number: String = (0..16)
        .map(|_| rng.random_range(0..10).to_string())
        .collect();

    format!("0{}", number)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_rand() {
        let result = generate_rand();

        assert_eq!(result.len(), 17);
        assert_eq!(result.chars().next(), Some('0'));
        assert!(result[1..].chars().all(|c| c.is_digit(10)));
        let mut seen = std::collections::HashSet::new();
        for _ in 0..100 {
            let r = generate_rand();
            assert!(seen.insert(r));
        }

        println!("Generated random: {}", result);
    }
}
