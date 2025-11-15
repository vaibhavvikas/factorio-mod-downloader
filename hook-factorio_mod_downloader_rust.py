# PyInstaller hook for factorio_mod_downloader_rust
# This ensures the Rust extension module is properly bundled

from PyInstaller.utils.hooks import collect_dynamic_libs, get_module_file_attribute
from PyInstaller.compat import is_win, is_darwin, is_linux
import os
import sys
from pathlib import Path

binaries = []
datas = []
hiddenimports = []

# Determine the correct extension suffix
if is_win:
    ext_suffix = '.pyd'
elif is_darwin:
    ext_suffix = '.dylib'
else:
    ext_suffix = '.so'

# Method 1: Try to get the module through PyInstaller's utility
try:
    rust_module_path = get_module_file_attribute('factorio_mod_downloader_rust')
    if rust_module_path and os.path.exists(rust_module_path):
        binaries.append((rust_module_path, '.'))
        print(f"[HOOK] ✓ Found Rust module via import: {rust_module_path}")
    else:
        raise ImportError("Module path not found")
except Exception as e:
    print(f"[HOOK] Method 1 failed: {e}")
    
    # Method 2: Try to find it in the package directory
    try:
        # Look in the installed package location
        import factorio_mod_downloader
        package_dir = Path(factorio_mod_downloader.__file__).parent
        rust_ext_path = package_dir / f'factorio_mod_downloader_rust{ext_suffix}'
        
        if rust_ext_path.exists():
            binaries.append((str(rust_ext_path), '.'))
            print(f"[HOOK] ✓ Found Rust module in package: {rust_ext_path}")
        else:
            raise FileNotFoundError(f"Not found at {rust_ext_path}")
    except Exception as e2:
        print(f"[HOOK] Method 2 failed: {e2}")
        
        # Method 3: Search in source directory (fallback for development)
        try:
            project_root = Path(__file__).parent
            search_paths = [
                project_root / 'src' / 'factorio_mod_downloader' / f'factorio_mod_downloader_rust{ext_suffix}',
                project_root / f'factorio_mod_downloader_rust{ext_suffix}',
            ]
            
            for search_path in search_paths:
                if search_path.exists():
                    binaries.append((str(search_path), '.'))
                    print(f"[HOOK] ✓ Found Rust module in source: {search_path}")
                    break
            else:
                print("[HOOK] ⚠ Warning: Rust module not found in any location!")
                print("[HOOK]   Searched:")
                for path in search_paths:
                    print(f"[HOOK]     - {path}")
        except Exception as e3:
            print(f"[HOOK] Method 3 failed: {e3}")

# Collect dynamic libraries that the Rust extension depends on
try:
    dynamic_libs = collect_dynamic_libs('factorio_mod_downloader_rust')
    if dynamic_libs:
        binaries.extend(dynamic_libs)
        print(f"[HOOK] ✓ Collected {len(dynamic_libs)} dynamic libraries")
except Exception as e:
    print(f"[HOOK] Note: Could not collect dynamic libs: {e}")

# On Windows, explicitly include common Rust runtime dependencies
if is_win:
    # These are common DLLs that Rust might depend on
    common_dlls = [
        'vcruntime140.dll',
        'vcruntime140_1.dll',
        'msvcp140.dll',
    ]
    
    # Try to find them in system directories
    import ctypes.util
    for dll in common_dlls:
        dll_path = ctypes.util.find_library(dll.replace('.dll', ''))
        if dll_path:
            binaries.append((dll_path, '.'))
            print(f"[HOOK] ✓ Added runtime dependency: {dll}")

# Ensure the module is in hidden imports
hiddenimports = ['factorio_mod_downloader_rust']

# Summary
print(f"[HOOK] Summary:")
print(f"[HOOK]   - Binaries: {len(binaries)}")
print(f"[HOOK]   - Data files: {len(datas)}")
print(f"[HOOK]   - Hidden imports: {len(hiddenimports)}")