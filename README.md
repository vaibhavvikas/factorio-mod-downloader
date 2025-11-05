# Factorio Mod Downloader

Recursively downloads Factorio mods and all required dependencies. No login required.

![Preview](https://github.com/Emmet-v15/factorio-mod-downloader/blob/main/factorio_mod_downloader.png)

## Features
- Dark mode
- Progress tracking
- Standalone (no dependencies)

## Download
Get the latest `.exe` from [Releases](https://github.com/emmet-v15/factorio-mod-downloader/releases/latest)

## Usage
1. Run the app and select a directory
2. Paste a mod URL from [mods.factorio.com](https://mods.factorio.com/) (e.g., `https://mods.factorio.com/mod/Krastorio2`)
3. Click Download
4. First run downloads Playwright browser binaries (~100MB)

## Development
```bash
# Install UV (https://docs.astral.sh/uv/getting-started/installation/)
uv sync
uv run python -m playwright install chromium
uv run factorio-mod-downloader

# Build executable (Windows x64)
uv sync
uv run pyinstaller factorio-mod-downloader.spec
# Output will be in /dist/
```

## Credits
- Mirror: re146.dev - [radioegor146](https://github.com/radioegor146)
- Forked from: [vaibhavvikas](https://github.com/vaibhavvikas)

---
**References:**
- [Official Factorio](https://factorio.com)
