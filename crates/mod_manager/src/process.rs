use sysinfo::{ProcessesToUpdate, System};

/// Check if Factorio is currently running on the host system.
pub fn is_factorio_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    for proc in sys.processes().values() {
        let name = proc.name().to_string_lossy().to_lowercase();
        if name == "factorio" || name == "factorio.exe" {
            return true;
        }
    }
    false
}
