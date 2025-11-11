# Build script for Factorio Mod Downloader
# Builds both Python package and Windows executable

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 Factorio Mod Downloader - Build Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if pyproject.toml exists
if (-not (Test-Path "pyproject.toml")) {
    Write-Host "❌ Error: pyproject.toml not found. Run this script from the project root." -ForegroundColor Red
    exit 1
}

# Step 1: Build Python package
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "🔨 Building Python package (wheel + tar.gz)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

uv build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed at package building step" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Python package build - SUCCESS" -ForegroundColor Green
Write-Host ""

# Step 2: Build Windows executable
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "🔨 Building Windows executable (.exe)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""

uv run pyinstaller src/factorio_mod_downloader/__main__.py --onefile --console --icon=factorio_downloader.ico --name=factorio-mod-downloader --clean

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed at executable building step" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Executable build - SUCCESS" -ForegroundColor Green
Write-Host ""

# Success summary
Write-Host "============================================================" -ForegroundColor Green
Write-Host "✅ BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Build artifacts:" -ForegroundColor Cyan
Write-Host "  - Python packages: dist/*.whl, dist/*.tar.gz"
Write-Host "  - Windows executable: dist/factorio-mod-downloader.exe"
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
