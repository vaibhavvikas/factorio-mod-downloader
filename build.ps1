# Build script for Factorio Mod Downloader with Rust module

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Building Factorio Mod Downloader with Rust" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

# Activate virtual environment
Write-Host "`nActivating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# Step 1: Build Rust module with maturin
Write-Host "`n[1/3] Building Rust module with maturin..." -ForegroundColor Yellow
maturin develop --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR Rust build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "OK Rust module built and installed successfully" -ForegroundColor Green

# Step 2: Copy .pyd to project root for PyInstaller
Write-Host "`n[2/4] Copying Rust module to project root..." -ForegroundColor Yellow
$pydPath = ".venv\Lib\site-packages\factorio_mod_downloader_rust\factorio_mod_downloader_rust.cp312-win_amd64.pyd"
if (Test-Path $pydPath) {
    Copy-Item $pydPath "factorio_mod_downloader_rust.pyd" -Force
    Write-Host "OK Copied $pydPath" -ForegroundColor Green
} else {
    Write-Host "ERROR Could not find .pyd file at $pydPath!" -ForegroundColor Red
    exit 1
}

# Step 3: Test Rust module import
Write-Host "`n[3/4] Testing Rust module import..." -ForegroundColor Yellow
python -c "import factorio_mod_downloader_rust; print('Rust module imports successfully')"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR Rust module import failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Build with PyInstaller
Write-Host "`n[4/4] Building executable with PyInstaller..." -ForegroundColor Yellow
deactivate; poetry build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR PyInstaller build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "OK Executable built successfully" -ForegroundColor Green

Write-Host "`n═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nExecutable location:" -ForegroundColor Yellow
Write-Host "  dist\pyinstaller\win_amd64\fmd-0.3.0.exe" -ForegroundColor White
Write-Host "`nTest with:" -ForegroundColor Yellow
Write-Host '  .\dist\pyinstaller\win_amd64\fmd-0.3.0.exe download https://mods.factorio.com/mod/FNEI -o ./test' -ForegroundColor White
