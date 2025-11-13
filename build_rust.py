"""Build script for Rust extension module."""

import subprocess
import sys
import shutil
from pathlib import Path


def build_rust_extension():
    """Build the Rust extension using cargo."""
    print("Building Rust extension...")
    
    # Check if cargo is installed
    try:
        subprocess.run(["cargo", "--version"], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ERROR: Cargo not found. Please install Rust from https://rustup.rs/")
        return False
    
    # Build the Rust extension
    try:
        result = subprocess.run(
            ["cargo", "build", "--release"],
            check=True,
            capture_output=True,
            text=True
        )
        print("Rust extension built successfully!")
        print(result.stdout)
        
        # Find the built library
        target_dir = Path("target/release")
        
        # Look for the library file (platform-specific)
        if sys.platform == "win32":
            lib_file = target_dir / "factorio_mod_downloader_rust.dll"
            dest_name = "factorio_mod_downloader_rust.pyd"
        elif sys.platform == "darwin":
            lib_file = target_dir / "libfactorio_mod_downloader_rust.dylib"
            dest_name = "factorio_mod_downloader_rust.so"
        else:
            lib_file = target_dir / "libfactorio_mod_downloader_rust.so"
            dest_name = "factorio_mod_downloader_rust.so"
        
        if not lib_file.exists():
            print(f"ERROR: Built library not found at {lib_file}")
            return False
        
        # Copy to src directory
        dest_dir = Path("src/factorio_mod_downloader")
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / dest_name
        
        shutil.copy2(lib_file, dest_file)
        print(f"Copied {lib_file} to {dest_file}")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Failed to build Rust extension")
        print(e.stderr)
        return False


if __name__ == "__main__":
    success = build_rust_extension()
    sys.exit(0 if success else 1)
