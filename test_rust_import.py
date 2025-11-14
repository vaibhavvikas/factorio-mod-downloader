#!/usr/bin/env python3
"""Test script to diagnose Rust module import issues."""

import sys
import os
import platform

print("=== Python Environment Info ===")
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Platform: {platform.platform()}")
print(f"Architecture: {platform.architecture()}")
print(f"Machine: {platform.machine()}")

print("\n=== Attempting to import Rust module ===")
try:
    import factorio_mod_downloader_rust
    print("✓ SUCCESS: Rust module imported successfully!")
    print(f"Module file: {factorio_mod_downloader_rust.__file__}")
    print(f"Available functions: {[x for x in dir(factorio_mod_downloader_rust) if not x.startswith('_')]}")
except ImportError as e:
    print(f"✗ IMPORT ERROR: {e}")
    
    # Check if the module file exists
    try:
        import site
        site_packages = site.getsitepackages()
        print(f"\nSite packages directories: {site_packages}")
        
        for sp in site_packages:
            rust_files = []
            if os.path.exists(sp):
                for file in os.listdir(sp):
                    if 'factorio_mod_downloader_rust' in file:
                        rust_files.append(os.path.join(sp, file))
            if rust_files:
                print(f"Found Rust files in {sp}: {rust_files}")
    except Exception as e2:
        print(f"Error checking site-packages: {e2}")

except Exception as e:
    print(f"✗ OTHER ERROR: {e}")

print("\n=== Environment Variables ===")
print(f"PATH: {os.environ.get('PATH', 'Not set')[:200]}...")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
