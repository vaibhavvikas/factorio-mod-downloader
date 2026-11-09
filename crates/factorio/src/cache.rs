use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry<T> {
    pub data: T,
    pub timestamp_secs: u64,
    pub ttl_secs: u64,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T, ttl: Duration) -> Self {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        Self {
            data,
            timestamp_secs: now,
            ttl_secs: ttl.as_secs(),
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now > self.timestamp_secs.saturating_add(self.ttl_secs)
    }
}

pub struct PortalCache {
    base_dir: PathBuf,
}

impl PortalCache {
    pub fn new(base_dir: impl Into<PathBuf>) -> Self {
        let dir = base_dir.into();
        let _ = fs::create_dir_all(&dir);
        Self { base_dir: dir }
    }

    fn file_path(&self, key: &str) -> PathBuf {
        let safe_key = key
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();
        self.base_dir.join(format!("{}.json", safe_key))
    }

    /// Read entry from cache. Returns (data, is_stale).
    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Option<(T, bool)> {
        let path = self.file_path(key);
        if !path.is_file() {
            return None;
        }

        let content = fs::read_to_string(&path).ok()?;
        let entry: CacheEntry<T> = serde_json::from_str(&content).ok()?;
        let expired = entry.is_expired();
        Some((entry.data, expired))
    }

    /// Atomically write an entry to cache.
    pub fn set<T: Serialize>(&self, key: &str, data: T, ttl: Duration) -> Result<(), std::io::Error> {
        let _ = fs::create_dir_all(&self.base_dir);
        let path = self.file_path(key);
        let tmp_path = path.with_extension("tmp");

        let entry = CacheEntry::new(data, ttl);
        let json = serde_json::to_string(&entry)?;

        fs::write(&tmp_path, json)?;
        fs::rename(&tmp_path, &path)?;
        Ok(())
    }
}
