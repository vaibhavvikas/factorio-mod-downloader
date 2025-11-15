
# Factorio Mod Downloader

[![GitHub Release](https://img.shields.io/github/v/release/vaibhavvikas/factorio-mod-downloader)](https://github.com/vaibhavvikas/factorio-mod-downloader/releases)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/vaibhavvikas/factorio-mod-downloader/total)

Factorio mod downloader, recursively downloads a mod and its all required dependencies. No hassle, no login required. Just put the mod url and select the path. Thats all.

It is really helpful if you want to download a mod or modpack containing various different recommended mods, that if you want to download separately will take you a lot of clicks and headache.

**If you love the game please buy it and support the developers. I am a big fan of the game.**

[Official Factorio Link](https://factorio.com)

![Factorio Mod Downloader](factorio_mod_downloader.png)


### Features
1. Added Dark Mode
2. Added progress bars and logs to see what files are being downloaded.
3. Added a seperate downloads section to track each file with custom progress and success icons.
4. Added speed and progress bar specific updates while file is getting downloaded.
5. Added multithreading downloads, i.e. file will be getting downloaded in background while new dependencies are being analyzed.
6. Updated to add the option to downlaod optional dependencies as well (Use with caution as it may significantly increase number of files getting downloaded).
7. Completely interactive and requires no other dependency. 100% standalone app.


### How to download
1. Go to [Releases](https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest) 
2. Download the latest executable i.e. **\*.exe file** from the latest version added inside the assets dropdown. Latest release version is mentioned on the top of README.md file.


### How to run
1. Run the app, select the directory and add mod url from official [factorio mod portal](https://mods.factorio.com/) for e.g. URL for Krastorio 2 mod is: `https://mods.factorio.com/mod/Krastorio2`.
2. Click on Download button.
3. The application will start downloading the mods and show the status and progress in the corresponding sections.
4. The first step of loading dependencies take some time as it download [chromium-drivers](https://github.com/yeongbin-jo/python-chromedriver-autoinstaller) (~30-35 MB) required for loading URLs and the mods for downloading.
5. Once completed the application will show a download complete dialog.


### Development

#### Prerequisites

Before you begin, ensure you have the following installed on your machine:

1. **Python 3.12 or 3.13**
   - Download from [python.org](https://python.org/downloads/)
   - During installation, check "Add Python to PATH"
   - Verify: `python --version`

2. **Rust (for building the performance extension)**
   - Download from [rustup.rs](https://rustup.rs/)
   - Verify: `rustc --version`

3. **Poetry (Python dependency manager)**
   - Install via: `pip install poetry`
   - Or follow [poetry official guide](https://python-poetry.org/docs/#installation)
   - Verify: `poetry --version
   - `poetry self add poetry-pyinstaller-plugin`(important)

4. **Maturin (Rust-Python bridge)**
   - Installed automatically by Poetry
   - Or manually: `pip install maturin`

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/vaibhavvikas/factorio-mod-downloader.git
cd factorio-mod-downloader

# Install dependencies and build Rust extension
.\build.ps1 -BuildExe # additionally builds the `.exe` available at `\dist\fmd-0.4.0.exe`

# Run the application (GUI mode)
poetry run python -m factorio_mod_downloader --gui

# Or run in CLI mode
poetry run python -m factorio_mod_downloader --help
```

### Note
I have finally included optional dependencies as well. My advice is handle with care as it significantly increase the number and size of downloads.
Also, download speed is based on re146, Its not super fast but its fine.
Feel free to reach out to me or start a message in the discussions tab if you need some help. 


### Credits:
- re146.dev
- [radioegor146](https://github.com/radioegor146)
