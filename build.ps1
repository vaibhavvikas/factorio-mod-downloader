# ===================================================================
# Build Script - Factorio Mod Downloader
# Complete workspace cleanup and fresh build
# ===================================================================

param(
    [switch]$SkipTests = $false,
    [switch]$BuildExe = $false,
    [switch]$KeepVenv = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "   [ERROR] $msg" -ForegroundColor Red }
function Write-Warning { param($msg) Write-Host "   [WARN] $msg" -ForegroundColor Yellow }
function Write-Info { param($msg) Write-Host "   [INFO] $msg" -ForegroundColor Gray }

# Calculate total steps based on flags
$totalSteps = 7
if ($BuildExe) { $totalSteps = 8 }

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "   Build Script - Factorio Mod Downloader" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# ===================================================================
# Step 1: Clean all build artifacts
# ===================================================================
Write-Step "[1/$totalSteps] Cleaning build artifacts..."

$foldersToRemove = @(
    "dist", "build", "*.egg-info", ".eggs", "target", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "src/factorio_mod_downloader/__pycache__",
    "src/factorio_mod_downloader/cli/__pycache__",
    "src/factorio_mod_downloader/core/__pycache__",
    "src/factorio_mod_downloader/gui/__pycache__",
    "src/factorio_mod_downloader/downloader/__pycache__",
    "src/factorio_mod_downloader/infrastructure/__pycache__",
    ".tox", ".nox", "htmlcov"
)

$filesToRemove = @(
    # Compiled Python
    "*.pyc", "*.pyo", "*.pyd",
    
    # Rust extension
    "factorio_mod_downloader_rust.pyd",
    "src/factorio_mod_downloader/factorio_mod_downloader_rust.pyd",
    
    # Lock files
    "*.lock",
    "Cargo.lock",
    "poetry.lock",
    "uv.lock",
    
    # Spec files
    "*.spec",
    
    # Logs
    "*.log",
    
    # OS files
    ".DS_Store", "Thumbs.db",
    
    # Coverage
    ".coverage", "coverage.xml"
)

$filesRemoved = 0
$foldersRemoved = 0

foreach ($pattern in $foldersToRemove) {
    $items = Get-ChildItem -Path . -Filter $pattern -Recurse -Directory -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        $foldersRemoved++
    }
}

foreach ($pattern in $filesToRemove) {
    $items = Get-ChildItem -Path . -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        Remove-Item -Path $item.FullName -Force -ErrorAction SilentlyContinue
        $filesRemoved++
    }
}

Write-Success "Cleaned $foldersRemoved folders and $filesRemoved files"

# ===================================================================
# Step 2: Handle virtual environment
# ===================================================================
if (-not $KeepVenv) {
    Write-Step "[2/$totalSteps] Removing and recreating virtual environment..."
    
    if (Test-Path ".venv") {
        Write-Info "Removing existing .venv..."
        Remove-Item -Path ".venv" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    Write-Info "Creating fresh virtual environment..."
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create virtual environment!"
        exit 1
    }
    Write-Success "Virtual environment created"
} else {
    Write-Step "[2/$totalSteps] Keeping existing virtual environment..."
    Write-Warning "Using existing .venv"
}

# ===================================================================
# Step 3: Activate virtual environment and upgrade tools
# ===================================================================
Write-Step "[3/$totalSteps] Activating virtual environment and upgrading tools..."

& .\.venv\Scripts\Activate.ps1

Write-Info "Upgrading pip, setuptools, wheel..."
python -m pip install --upgrade pip setuptools wheel --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upgrade pip!"
    exit 1
}

Write-Info "Installing build tools (maturin, poetry)..."
pip install maturin poetry --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install build tools!"
    exit 1
}

Write-Success "Tools installed and upgraded"

# ===================================================================
# Step 4: Install Poetry dependencies
# ===================================================================
Write-Step "[4/$totalSteps] Installing Poetry dependencies..."

Write-Info "Clearing Poetry cache..."
poetry cache clear pypi --all -n 2>$null

Write-Info "Installing dependencies..."
poetry install --no-root
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Poetry install had issues, but continuing..."
}

Write-Success "Dependencies installed"

# ===================================================================
# Step 5: Build Rust extension with Maturin
# ===================================================================
Write-Step "[5/$totalSteps] Building Rust extension with Maturin..."

Write-Info "Compiling Rust code in release mode..."
poetry run maturin develop --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Rust build failed!"
    exit 1
}

Write-Info "Locating built Rust extension..."

# Search recursively for the .pyd file
$rustExtSource = Get-ChildItem -Path ".\.venv\Lib\site-packages" -Recurse -File | 
                 Where-Object { $_.Extension -eq ".pyd" -and $_.Name -match "factorio_mod_downloader_rust" } | 
                 Select-Object -First 1

if ($rustExtSource) {
    Write-Success "Found Rust extension!"
    Write-Info "  Location: $($rustExtSource.FullName)"
    Write-Info "  Size: $([math]::Round($rustExtSource.Length / 1MB, 2)) MB"
    
    $destPath = "src\factorio_mod_downloader\factorio_mod_downloader_rust.pyd"
    Copy-Item $rustExtSource.FullName $destPath -Force
    
    if (Test-Path $destPath) {
        Write-Success "Copied to package directory"
    } else {
        Write-Error "Failed to copy Rust extension!"
        exit 1
    }
} else {
    Write-Error "Rust extension (.pyd) not found in venv!"
    exit 1
}

Write-Success "Rust module built successfully"

# ===================================================================
# Step 6: Install the package
# ===================================================================
Write-Step "[6/$totalSteps] Installing the package..."

poetry install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Package installation failed!"
    exit 1
}

Write-Success "Package installed"

# ===================================================================
# Step 7: Run tests
# ===================================================================
if (-not $SkipTests) {
    Write-Step "[7/$totalSteps] Running tests..."
    
    # Test 1: Rust module import
    Write-Info "Testing Rust module import..."
    $testResult = python -c "import factorio_mod_downloader_rust; print('OK')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Rust module import failed!"
        Write-Host $testResult -ForegroundColor Red
        exit 1
    }
    Write-Success "Rust module import test passed"
    
    # Test 2: Package import and version
    Write-Info "Testing package import..."
    $testResult = python -c "from factorio_mod_downloader import __version__; print(f'v{__version__}')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Package import failed!"
        Write-Host $testResult -ForegroundColor Red
        exit 1
    }
    Write-Success "Package import test passed: $testResult"
    
    # Test 3: Run test_package.py if exists
    if (Test-Path "test_package.py") {
        Write-Info "Running package structure test..."
        poetry run python test_package.py
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Package structure test passed"
        } else {
            Write-Warning "Package structure test had issues"
        }
    }
    
    Write-Success "All tests passed!"
} else {
    Write-Step "[7/$totalSteps] Skipping tests (SkipTests flag used)"
}

# ===================================================================
# Step 8: Build executable (only if -BuildExe flag is used)
# ===================================================================
if ($BuildExe) {
    Write-Step "[8/$totalSteps] Building executable with PyInstaller..."
    
    Write-Info "Building with custom PyInstaller command..."
    
    # Build manually with all necessary flags
    pyinstaller `
        --onefile `
        --name "fmd" `
        --icon "factorio_downloader.ico" `
        --add-data "factorio_downloader.ico;." `
        --add-data "src/factorio_mod_downloader/factorio_mod_downloader_rust.pyd;." `
        --collect-all factorio_mod_downloader `
        --collect-all customtkinter `
        --collect-all tkinter `
        --hidden-import tkinter `
        --hidden-import tkinter.ttk `
        --hidden-import tkinter.messagebox `
        --hidden-import tkinter.filedialog `
        --hidden-import _tkinter `
        --hidden-import factorio_mod_downloader_rust `
        --console `
        --noconfirm `
        --clean `
        "src/factorio_mod_downloader/__main__.py"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "PyInstaller build failed!"
        exit 1
    }
    
    # Check if executable was created
    $exePath = Get-Item "dist/fmd.exe" -ErrorAction SilentlyContinue
    if ($exePath) {
        Write-Success "Executable built successfully!"
        Write-Info "  Name: $($exePath.Name)"
        Write-Info "  Size: $([math]::Round($exePath.Length / 1MB, 2)) MB"
        Write-Info "  Path: $($exePath.FullName)"
    } else {
        Write-Warning "Executable not found"
    }
}

# ===================================================================
# Summary
# ===================================================================
Write-Host "`n===================================================================" -ForegroundColor Green
Write-Host "   Build Complete!" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green

if ($BuildExe) {
    Write-Host "`nExecutable ready for distribution!" -ForegroundColor Cyan
    $exePath = Get-ChildItem -Path "dist" -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exePath) {
        Write-Host "  Location: $($exePath.FullName)" -ForegroundColor White
        Write-Host "  Size: $([math]::Round($exePath.Length / 1MB, 2)) MB" -ForegroundColor White
    }
} else {
    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "  [1] Build executable: poetry build" -ForegroundColor White
    Write-Host "      Or run: .\build.ps1 -BuildExe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [2] Test CLI: poetry run python -m factorio_mod_downloader --help" -ForegroundColor White
    Write-Host ""
    Write-Host "  [3] Test download:" -ForegroundColor White
    Write-Host "      poetry run python -m factorio_mod_downloader download MOD_URL -o ./test" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [4] Test GUI: poetry run python -m factorio_mod_downloader --gui" -ForegroundColor White
}

Write-Host "`nUsage Examples:" -ForegroundColor Yellow
Write-Host "  .\build.ps1                      # Full build with tests" -ForegroundColor Gray
Write-Host "  .\build.ps1 -BuildExe            # Build + create .exe" -ForegroundColor Gray
Write-Host "  .\build.ps1 -SkipTests -BuildExe # Fast build to .exe" -ForegroundColor Gray
Write-Host "  .\build.ps1 -KeepVenv -BuildExe  # Reuse venv, build .exe" -ForegroundColor Gray

Write-Host ""