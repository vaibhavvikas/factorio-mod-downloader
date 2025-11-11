#!/bin/bash
# Build script for Factorio Mod Downloader
# Builds both Python package and Windows executable

set -e  # Exit on error

echo ""
echo "============================================================"
echo "🚀 Factorio Mod Downloader - Build Script"
echo "============================================================"
echo ""

# Check if pyproject.toml exists
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: pyproject.toml not found. Run this script from the project root."
    exit 1
fi

# Step 1: Build Python package
echo "============================================================"
echo "🔨 Building Python package (wheel + tar.gz)"
echo "============================================================"
echo ""

uv build

echo ""
echo "✅ Python package build - SUCCESS"
echo ""

# Step 2: Build Windows executable
echo "============================================================"
echo "🔨 Building Windows executable (.exe)"
echo "============================================================"
echo ""

uv run pyinstaller src/factorio_mod_downloader/__main__.py \
    --onefile \
    --console \
    --icon=factorio_downloader.ico \
    --name=factorio-mod-downloader \
    --clean

echo ""
echo "✅ Executable build - SUCCESS"
echo ""

# Success summary
echo "============================================================"
echo "✅ BUILD COMPLETED SUCCESSFULLY!"
echo "============================================================"
echo ""
echo "📦 Build artifacts:"
echo "  • Python packages: dist/*.whl, dist/*.tar.gz"
echo "  • Windows executable: dist/factorio-mod-downloader.exe"
echo ""
echo "============================================================"
echo ""
