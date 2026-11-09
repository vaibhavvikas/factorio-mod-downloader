# Factorio Mod Downloader

[![GitHub Release](https://img.shields.io/github/v/release/vaibhavvikas/factorio-mod-downloader)](https://github.com/vaibhavvikas/factorio-mod-downloader/releases)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/vaibhavvikas/factorio-mod-downloader/total)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Factorio Mod Downloader** is a high-performance cross-platform desktop application built in **100% Rust and Tauri v2** with **React 19**, **Tailwind CSS v4**, and **shadcn/ui**. It recursively resolves mod dependency trees, fetches compatibility requirements, and downloads full modpacks in parallel—**no browser drivers, no python scripts, and no login required**.

Simply search online mods, paste a Factorio Mod Portal URL or mod ID, inspect version constraints and optional dependencies, and click **Download All**.

> **Note**: *If you love Factorio, please support Wube Software by purchasing the game at [factorio.com](https://factorio.com).*

---

## 📸 Screenshots

| **🔍 Explore & Online Search** |
|:---:|
| ![Explore & Online Search](docs/screenshots/1.png) |

| **🌳 Dependency Resolver & Queue** | **📦 Installed Mod Manager** |
|:---:|:---:|
| ![Dependency Resolver & Queue](docs/screenshots/2.png) | ![Installed Mod Manager](docs/screenshots/3.png) |

---

## ✨ Features

- **🚀 100% Native Rust Performance**: Built with a modular Rust workspace (`factorio`, `parser`, `downloader`, `mod_manager`, `common`, `cli`, and `gui`). Zero browser automation drivers needed.
- **🔍 Online Explore & Category Search**: Browse Factorio Mod Portal releases with real-time text search, version selection (2.0 / Space Age, 1.1, etc.), category filters (*Library*, *Logistics*, *Overhauls*), and smart description tooltips.
- **🌳 Recursive Dependency Graph Resolver**: Automatically resolves required, recommended, and optional dependencies for complex overhauls (*Krastorio 2*, *Space Age*, *Freight Forwarding*, *Bob/Angel*, etc.). Toggle between **Mod Cards** and interactive **Dependency Tree** graph view.
- **📦 Installed Mod Manager & One-Click Updates**: Automatically scan your installed mods folder, compute reverse dependency locks, detect online updates, and resolve batch upgrades safely.
- **🗂️ Mod Collections & Presets**: Save, apply, import, and export custom mod collection configurations (JSON) to easily switch between different modded playthroughs and modpacks.
- **⚙️ Custom Version Selection & Toggles**: Fine-tune specific mod version releases and toggle optional or recommended dependencies per mod.
- **🔄 Parallel Download Manager**: Multi-threaded parallel downloading with streaming speed indicators, exact file sizes, and inactivity timeout guards.
- **🔁 Auto-Retry & Recovery**: Automatic 3-attempt retry loop for interrupted downloads, plus manual one-click **Retry** buttons for failed items.
- **🎨 Modern Design System**: Clean dark/light theme tokens, hardware-accelerated transitions, and accessible UI controls powered by shadcn/ui.
- **🌐 Direct Standalone Executables**: Native portable binaries for **Windows (x64 .exe)**, **macOS (Universal Binary)**, and **Linux (x86_64 ELF)**—no installation or setup wizard required.

---

## 🖥️ How to Use

1. Download the direct executable or archive for your OS from the [Releases](https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest) page.
2. Launch **Factorio Mod Downloader**:
   - **🪟 Windows**: Double-click `factorio-mod-downloader-gui-windows-x64.exe`.
   - **🍎 macOS**: Unzip `factorio-mod-downloader-gui-macos-universal.app.zip` and open `Factorio Mod Downloader.app`.
   - **🐧 Linux**: Extract the `.tar.gz` archive, grant executable permission, and run:
     ```bash
     tar -xzvf factorio-mod-downloader-gui-*-linux-x64.tar.gz
     chmod +x factorio-mod-downloader-gui-linux-x64
     ./factorio-mod-downloader-gui-linux-x64
     ```
     > 💡 **Linux Dependency Note**: Tauri desktop applications on Linux require WebKitGTK 4.1. If you get a missing `libwebkit2gtk-4.1.so.0` error, install it using your package manager:
     > - **Ubuntu / Debian / Mint**: `sudo apt update && sudo apt install -y libwebkit2gtk-4.1-0 libgtk-3-0`
     > - **Fedora / RHEL**: `sudo dnf install webkit2gtk4.1 gtk3`
     > - **Arch Linux / Manjaro**: `sudo pacman -S webkit2gtk-4.1 gtk3`
3. Set your target **Mods Folder** (automatically detected on boot).
4. Browse mods in the **Explore** tab or paste a mod URL (e.g., `https://mods.factorio.com/mod/Krastorio2`) in the **Mod Queue**.
5. Adjust versions or optional dependencies if needed, then click **Download All**.
6. Monitor progress in real time via the **Download Manager** drawer!

---

## 🛠️ Project Workspace Architecture

```
.
├── apps/
│   ├── cli/             # Standalone Rust CLI runner (factorio-mod-downloader-cli)
│   └── gui/             # Tauri v2 Desktop GUI (Rust backend + React 19 + TailwindCSS v4)
├── crates/
│   ├── common/          # Shared data models, app configuration, and utilities
│   ├── downloader/      # Multi-threaded parallel streaming downloader engine
│   ├── factorio/        # Factorio Mod Portal API client & dependency graph resolver
│   ├── mod_manager/     # Installed mods manager, update checker, and collection presets
│   └── parser/          # Info.json dependency parser & version constraint evaluator
└── Cargo.toml           # Root Cargo workspace manifest
```

---

## 🏗️ Building from Source

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (1.85+ for Rust 2024 Edition)
- [Node.js](https://nodejs.org/) (v24+, managed via `.nvmrc`)
- Platform build toolchains:
  - **Windows**: Visual Studio C++ Build Tools & WebView2
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Build Desktop GUI
```bash
# Clone the repository
git clone https://github.com/vaibhavvikas/factorio-mod-downloader.git
cd factorio-mod-downloader/apps/gui

# Install frontend dependencies
npm ci

# Run in Development Mode
npx tauri dev

# Build Standalone Executable
npx tauri build --no-bundle
```

### Build CLI
```bash
# From workspace root
cargo build --release -p factorio-mod-downloader-cli
```

---

## 💳 Credits & Acknowledgments
- Factorio Mod Portal API & [Factorio.com](https://factorio.com) by Wube Software.
- Community storage mirrors by [re146.dev](https://re146.dev) & [@radioegor146](https://github.com/radioegor146).

---

## ⚠️ Disclaimer
*Factorio Mod Downloader* is an independent, community-developed open-source software and is **not developed by, affiliated with, or endorsed by Wube Software**. Factorio and all associated game logos, trademarks, and assets belong to Wube Software.

---

## 📄 License
Distributed under the [MIT License](LICENSE).
