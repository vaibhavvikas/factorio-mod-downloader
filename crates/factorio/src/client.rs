//! HTTP client layer for communicating with external APIs.
//!
//! This module handles:
//! - HTTP client creation
//! - Request configuration
//! - Authentication headers
//! - Common HTTP error handling

pub struct ApiClient {
    client: reqwest::Client,
}

impl ApiClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
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
