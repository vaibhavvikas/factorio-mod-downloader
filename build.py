"""Custom build script to integrate Maturin with Poetry."""
import os
import shutil
import subprocess
import sys
from pathlib import Path


def build(setup_kwargs):
    """
    This function is called by Poetry's build system.
    It builds the Rust extension before the Python package.
    """
    print("=" * 70)
    print("🦀 Building Rust extension with Maturin...")
    print("=" * 70)
    
    build_rust_extension()
    copy_rust_extension()


def build_rust_extension():
    """Build the Rust extension using Maturin."""
    try:
        # Check if maturin is installed
        try:
            subprocess.run(
                [sys.executable, "-m", "maturin", "--version"],
                check=True,
                capture_output=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("📦 Installing Maturin...")
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "maturin>=1.0,<2.0"],
                check=True
            )
        
        # Build the Rust extension in release mode
        print("🔨 Compiling Rust code (this may take a few minutes)...")
        result = subprocess.run(
            [
                sys.executable, "-m", "maturin", "build",
                "--release",
                "--strip",
                "--interpreter", sys.executable
            ],
            check=True,
            capture_output=True,
            text=True,
            env={**os.environ, "RUST_BACKTRACE": "1"}
        )
        
        if result.stdout:
            print(result.stdout)
        
        # Also build in develop mode to install in current environment
        print("📦 Installing Rust extension in development mode...")
        result = subprocess.run(
            [sys.executable, "-m", "maturin", "develop", "--release"],
            check=True,
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            print(result.stdout)
            
        print("✅ Rust extension built successfully!")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error building Rust extension:")
        print(f"   stdout: {e.stdout}")
        print(f"   stderr: {e.stderr}")
        sys.exit(1)


def copy_rust_extension():
    """Copy the built Rust extension to the Python source directory."""
    print("\n📋 Copying Rust extension to source directory...")
    
    # Determine extension suffix based on platform
    if sys.platform == "win32":
        ext_suffix = ".pyd"
    elif sys.platform == "darwin":
        ext_suffix = ".dylib"
    else:
        ext_suffix = ".so"
    
    # Find the built extension in site-packages
    site_packages = Path(sys.prefix) / "Lib" / "site-packages"
    if not site_packages.exists():
        # Try alternate location for non-Windows
        site_packages = Path(sys.prefix) / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
    
    extension_files = list(site_packages.glob(f"factorio_mod_downloader_rust*{ext_suffix}"))
    
    if not extension_files:
        print(f"⚠️  Warning: Built extension not found in {site_packages}")
        print("   Searching in current directory...")
        extension_files = list(Path(".").glob(f"**/*factorio_mod_downloader_rust*{ext_suffix}"))
    
    if not extension_files:
        print("❌ Could not find built Rust extension!")
        return
    
    src_file = extension_files[0]
    dest_dir = Path("src") / "factorio_mod_downloader"
    dest_file = dest_dir / f"factorio_mod_downloader_rust{ext_suffix}"
    
    # Create destination directory if it doesn't exist
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy the extension
    shutil.copy2(src_file, dest_file)
    print(f"✅ Copied {src_file.name} -> {dest_file}")
    print(f"   Size: {dest_file.stat().st_size / (1024*1024):.2f} MB")


if __name__ == "__main__":
    # Allow running this script directly for testing
    build({})