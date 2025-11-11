
# Factorio Mod Downloader

[![GitHub Release](https://img.shields.io/github/v/release/vaibhavvikas/factorio-mod-downloader)](https://github.com/vaibhavvikas/factorio-mod-downloader/releases)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/vaibhavvikas/factorio-mod-downloader/total)

Factorio mod downloader, recursively downloads a mod and its all required dependencies. No hassle, no login required. Just put the mod url and select the path. Thats all.

It is really helpful if you want to download a mod or modpack containing various different recommended mods, that if you want to download separately will take you a lot of clicks and headache.

**If you love the game please buy it and support the developers. I am a big fan of the game.**

[Official Factorio Link](https://factorio.com)

![Factorio Mod Downloader](factorio_mod_downloader.png)


### Features

#### GUI Features
1. Dark Mode interface
2. Progress bars and logs to see what files are being downloaded
3. Separate downloads section to track each file with custom progress and success icons
4. Speed and progress bar specific updates while file is getting downloaded
5. Multithreading downloads - files download in background while new dependencies are being analyzed
6. Option to download optional dependencies (Use with caution as it may significantly increase number of files)
7. Completely interactive and requires no other dependency - 100% standalone app

#### CLI Features
1. Command-line interface for automation and scripting
2. Batch download support - download multiple mods from a file
3. Configuration file management - save your preferences
4. Structured logging system with file output
5. Resume interrupted downloads automatically
6. Check for mod updates and update mods to latest versions
7. Dry-run mode to preview downloads without downloading
8. JSON output for machine parsing
9. Colored terminal output with progress bars


### How to download
1. Go to [Releases](https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest) 
2. Download the latest executable i.e. **\*.exe file** from the latest version added inside the assets dropdown. Latest release version is mentioned on the top of README.md file.


### How to run

#### GUI Mode (Default)
1. Run the app without arguments: `factorio-mod-downloader`
2. Select the directory and add mod url from official [factorio mod portal](https://mods.factorio.com/) for e.g. URL for Krastorio 2 mod is: `https://mods.factorio.com/mod/Krastorio2`
3. Click on Download button
4. The application will start downloading the mods and show the status and progress in the corresponding sections
5. The first step of loading dependencies take some time as it downloads [chromium-drivers](https://github.com/yeongbin-jo/python-chromedriver-autoinstaller) (~30-35 MB) required for loading URLs and the mods for downloading
6. Once completed the application will show a download complete dialog

#### CLI Mode

**Download a single mod:**
```bash
factorio-mod-downloader download https://mods.factorio.com/mod/Krastorio2
```

**Download with optional dependencies:**
```bash
factorio-mod-downloader download https://mods.factorio.com/mod/Krastorio2 --include-optional
```

**Download to specific directory:**
```bash
factorio-mod-downloader download https://mods.factorio.com/mod/Krastorio2 -o ./my-mods
```

**Batch download from JSON file:**
```bash
factorio-mod-downloader batch mods.json -o ./mods
```

**Check for mod updates:**
```bash
factorio-mod-downloader check-updates ./mods
```

**Update mods to latest versions:**
```bash
factorio-mod-downloader update ./mods
```

**Dry-run (preview without downloading):**
```bash
factorio-mod-downloader download https://mods.factorio.com/mod/Krastorio2 --dry-run
```

**Validate downloaded mods:**
```bash
factorio-mod-downloader validate ./mods
```

**Get help:**
```bash
factorio-mod-downloader --help
factorio-mod-downloader download --help
```


### Configuration

The CLI supports a configuration file to save your preferences. Configuration is stored at `~/.factorio-mod-downloader/config.yaml`.

**Initialize configuration:**
```bash
factorio-mod-downloader config init
```

**View all settings:**
```bash
factorio-mod-downloader config list
```

**Get a specific setting:**
```bash
factorio-mod-downloader config get default_output_path
```

**Set a setting:**
```bash
factorio-mod-downloader config set default_output_path ./my-mods
```

**Available configuration options:**
- `default_output_path`: Default directory for downloaded mods (default: `./mods`)
- `include_optional_deps`: Include optional dependencies by default (default: `false`)
- `max_retries`: Maximum retry attempts for failed downloads (default: `3`)
- `retry_delay`: Delay in seconds between retries (default: `2`)
- `log_level`: Logging level - DEBUG, INFO, WARNING, ERROR, CRITICAL (default: `INFO`)
- `concurrent_downloads`: Number of concurrent downloads (default: `3`)

**Logs:**
Logs are stored at `~/.factorio-mod-downloader/logs/factorio-mod-downloader.log` with automatic rotation (10MB max, 5 backups).

### Development

#### Setup
1. You can build and run the app yourself. The code is written in Python and uses `uv` for dependency management and easy builds.
2. Install Python >= 3.12 and install `uv`, refer to [uv installation guide](https://docs.astral.sh/uv/getting-started/installation/) for installation instructions.
3. Install dependencies via the command `uv sync`.
4. To run the application use the command `uv run factorio-mod-downloader`. This will run the application directly without building.

#### Building

To build both the Python package and Windows executable, use the provided build scripts:

**Windows (PowerShell):**
```powershell
.\build.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x build.sh
./build.sh
```

**Python script (cross-platform):**
```bash
uv run python build.py
```

**Manual build (if needed):**
```bash
# Build Python package only
uv build

# Build Windows executable only
uv run pyinstaller src/factorio_mod_downloader/__main__.py --onefile --console --icon=factorio_downloader.ico --name=factorio-mod-downloader --clean
```

**Poetry (with plugin) - Recommended:**
```bash
# IMPORTANT: Run this OUTSIDE the virtual environment
# Your prompt should NOT show (factorio-mod-downloader)
poetry build  # Automatically builds both package and .exe
```

**⚠️ Important:** If you get a permission error, make sure you're NOT in an activated virtual environment. Close your terminal and run `poetry build` in a fresh terminal.

**Build artifacts:**
- Python packages: `dist/*.whl`, `dist/*.tar.gz`
- Windows executable: `dist/factorio-mod-downloader.exe`

**Note:** You need a **Windows x64** system to build the Windows executable.


### Batch File Format

For batch downloads, create a JSON file with a `mods` array containing mod URLs.

**Example batch file (mods.json):**
```json
{
  "name": "Essential Factorio Mods",
  "description": "A curated collection of must-have mods",
  "version": "1.0",
  "mods": [
    "https://mods.factorio.com/mod/Krastorio2",
    "https://mods.factorio.com/mod/space-exploration",
    "https://mods.factorio.com/mod/FNEI",
    "https://mods.factorio.com/mod/even-distribution",
    "https://mods.factorio.com/mod/Squeak Through"
  ]
}
```

**Alternative format (simple array):**
```json
[
  "https://mods.factorio.com/mod/Krastorio2",
  "https://mods.factorio.com/mod/space-exploration"
]
```

**Important:** By default, mods are downloaded to your Factorio installation directory (`%APPDATA%\Factorio\mods` on Windows). If Factorio is not installed or hasn't been run at least once, you must specify a custom output directory with `-o/--output`.

### Note
I have finally included optional dependencies as well. My advice is handle with care as it significantly increases the number and size of downloads.

Also, download speed is based on re146. It's not super fast but it's fine.

Feel free to reach out to me or start a message in the discussions tab if you need some help. 


### Credits:
- re146.dev
- [radioegor146](https://github.com/radioegor146)

