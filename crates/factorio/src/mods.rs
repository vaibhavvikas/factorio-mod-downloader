use crate::client::ApiClient;
use crate::models::ModInfo;
use serde_json::{self};

const MOD_PORTAL_API_URL: &str = "https://mods.factorio.com/api/mods";

pub async fn get_mod(
    api_client: &ApiClient,
    mod_id: &str,
) -> Result<ModInfo, Box<dyn std::error::Error>> {
    let url = format!("{}/{}/full", MOD_PORTAL_API_URL, mod_id);
    let response = api_client.get(&url, &[]).await?;

    let mod_info: ModInfo = serde_json::from_str(&response)?;
    Ok(mod_info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_call_get_mod() {
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
        let api_client = ApiClient::new();
        let result = get_mod(&api_client, "NonExistentMod12345").await;

        assert!(result.is_err());
    }
}
