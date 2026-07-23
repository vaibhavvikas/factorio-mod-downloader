//! HTTP client layer for communicating with external APIs.
//!
//! This module handles:
//! - HTTP client creation
//! - Request configuration
//! - Authentication headers
//! - Common HTTP error handling

pub const DEFAULT_USER_AGENT: &str = "FactorioModDownloader/1.0";

#[derive(Clone, Debug)]
pub struct ApiClient {
    client: reqwest::Client,
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new()
    }
}

impl ApiClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent(DEFAULT_USER_AGENT)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        Self { client }
    }

    pub async fn get(&self, url: &str, params: &[(&str, &str)]) -> Result<String, reqwest::Error> {
        let response = self
            .client
            .get(url)
            .query(params)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;

        Ok(response)
    }
}
