# PyInstaller hook for factorio_mod_downloader_rust
# This ensures the Rust extension module is properly bundled

from PyInstaller.utils.hooks import collect_dynamic_libs, get_module_file_attribute
import os

# Get the location of the Rust module
try:
    rust_module_path = get_module_file_attribute('factorio_mod_downloader_rust')
    if rust_module_path and os.path.exists(rust_module_path):
        # Add the Rust module as a binary
        binaries = [(rust_module_path, '.')]
        print(f"[HOOK] Found Rust module at: {rust_module_path}")
    else:
        binaries = []
        print("[HOOK] Rust module not found!")
except Exception as e:
    binaries = []
    print(f"[HOOK] Error finding Rust module: {e}")

# Also collect any dynamic libraries the Rust module depends on
datas = []
hiddenimports = []
