# Clean rebuild script - removes all build artifacts and rebuilds from scratch

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Clean Rebuild - Factorio Mod Downloader" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Clean all build artifacts
Write-Host "`n[1/5] Cleaning build artifacts..." -ForegroundColor Yellow

$foldersToRemove = @(
    "dist",
    "build",
    ".venv",
    "target",
    "__pycache__",
    "src\factorio_mod_downloader\__pycache__",
    "src\factorio_mod_downloader\cli\__pycache__",
    "src\factorio_mod_downloader\core\__pycache__",
    "src\factorio_mod_downloader\infrastructure\__pycache__"
)

$filesToRemove = @(
    "poetry.lock",
    "factorio_mod_downloader_rust.pyd",
    "*.pyc"
)

foreach ($folder in $foldersToRemove) {
    if (Test-Path $folder) {
        Write-Host "  Removing $folder..." -ForegroundColor Gray
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
    }
}

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Write-Host "  Removing $file..." -ForegroundColor Gray
        Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "OK Cleaned build artifacts" -ForegroundColor Green

# Step 2: Create fresh virtual environment
Write-Host "`n[2/5] Creating fresh virtual environment..." -ForegroundColor Yellow
python -m venv .venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR Failed to create venv!" -ForegroundColor Red
    exit 1
}
Write-Host "OK Virtual environment created" -ForegroundColor Green

# Step 3: Activate venv and install poetry dependencies
Write-Host "`n[3/5] Installing Poetry dependencies..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install maturin poetry
poetry install --no-root
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING Poetry install had issues, continuing..." -ForegroundColor Yellow
}
Write-Host "OK Dependencies installed" -ForegroundColor Green

# Step 4: Build Rust module with maturin
Write-Host "`n[4/5] Building Rust module with maturin..." -ForegroundColor Yellow
maturin develop --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR Rust build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Rust module built and installed" -ForegroundColor Green

# Step 5: Test Rust module
Write-Host "`n[5/5] Testing Rust module..." -ForegroundColor Yellow
python -c 'import factorio_mod_downloader_rust; print("Rust module works!")'
if ($LASTEXITCODE -ne 0) {
    Write-Host "X Rust module test failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Clean Rebuild Complete!" -ForegroundColor Green
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Run: poetry build" -ForegroundColor White
Write-Host "  2. Test: poetry run fmd download <URL> -o ./test" -ForegroundColor White
