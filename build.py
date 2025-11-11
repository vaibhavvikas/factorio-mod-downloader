#!/usr/bin/env python3
"""Build script for Factorio Mod Downloader.

This script builds both the Python package and the Windows executable.
"""

import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], description: str) -> bool:
    """Run a command and return success status.
    
    Args:
        cmd: Command to run as list of strings.
        description: Description of what the command does.
        
    Returns:
        True if command succeeded, False otherwise.
    """
    print(f"\n{'='*60}")
    print(f"🔨 {description}")
    print(f"{'='*60}")
    print(f"Running: {' '.join(cmd)}\n")
    
    try:
        result = subprocess.run(cmd, check=True)
        print(f"\n✅ {description} - SUCCESS")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} - FAILED")
        print(f"Error: {e}")
        return False


def main():
    """Main build function."""
    print("\n" + "="*60)
    print("🚀 Factorio Mod Downloader - Build Script")
    print("="*60)
    
    # Check if we're in the right directory
    if not Path("pyproject.toml").exists():
        print("❌ Error: pyproject.toml not found. Run this script from the project root.")
        sys.exit(1)
    
    # Step 1: Build Python package (wheel and tar.gz)
    if not run_command(
        ["uv", "build"],
        "Building Python package (wheel + tar.gz)"
    ):
        print("\n❌ Build failed at package building step")
        sys.exit(1)
    
    # Step 2: Build Windows executable with PyInstaller
    pyinstaller_cmd = [
        "uv", "run", "pyinstaller",
        "src/factorio_mod_downloader/__main__.py",
        "--onefile",
        "--console",
        "--icon=factorio_downloader.ico",
        "--name=factorio-mod-downloader",
        "--clean"
    ]
    
    if not run_command(
        pyinstaller_cmd,
        "Building Windows executable (.exe)"
    ):
        print("\n❌ Build failed at executable building step")
        sys.exit(1)
    
    # Success summary
    print("\n" + "="*60)
    print("✅ BUILD COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("\n📦 Build artifacts:")
    print("  • Python packages: dist/*.whl, dist/*.tar.gz")
    print("  • Windows executable: dist/factorio-mod-downloader.exe")
    print("\n" + "="*60 + "\n")


if __name__ == "__main__":
    main()
