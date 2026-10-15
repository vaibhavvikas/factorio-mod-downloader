pub mod event_bus;

pub use event_bus::{emit_log, emit_log_with_tag, subscribe, AppLogPayload, EventBus};
