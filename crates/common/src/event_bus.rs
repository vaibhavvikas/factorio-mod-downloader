use chrono::Local;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use tokio::sync::broadcast;

static LOG_COUNTER: AtomicU64 = AtomicU64::new(1);
const DEFAULT_CHANNEL_CAPACITY: usize = 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppLogPayload {
    pub id: String,
    pub timestamp: String,
    pub level: String,
    pub tag: String,
    pub message: String,
}

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<AppLogPayload>,
}

static GLOBAL_BUS: OnceLock<EventBus> = OnceLock::new();

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(DEFAULT_CHANNEL_CAPACITY);
        Self { sender }
    }

    pub fn global() -> &'static EventBus {
        GLOBAL_BUS.get_or_init(Self::new)
    }

    pub fn emit(&self, level: &str, tag: &str, message: &str) {
        let id_num = LOG_COUNTER.fetch_add(1, Ordering::Relaxed);
        let now = Local::now().format("%-I:%M:%S %p").to_string();
        let payload = AppLogPayload {
            id: format!("be-{}", id_num),
            timestamp: now,
            level: level.to_string(),
            tag: tag.to_string(),
            message: message.to_string(),
        };
        let _ = self.sender.send(payload);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AppLogPayload> {
        self.sender.subscribe()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

/// Emit an application log event to the global event bus
pub fn emit_log(level: &str, message: &str) {
    EventBus::global().emit(level, level, message);
}

/// Emit an application log event to the global event bus with a custom tag
pub fn emit_log_with_tag(level: &str, tag: &str, message: &str) {
    EventBus::global().emit(level, tag, message);
}

/// Subscribe to the global log event stream
pub fn subscribe() -> broadcast::Receiver<AppLogPayload> {
    EventBus::global().subscribe()
}
