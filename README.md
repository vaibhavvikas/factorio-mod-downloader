# Factorio Mod Downloader

[![GitHub Release](https://img.shields.io/github/v/release/vaibhavvikas/factorio-mod-downloader)](https://github.com/vaibhavvikas/factorio-mod-downloader/releases)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/vaibhavvikas/factorio-mod-downloader/total)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Factorio Mod Downloader** is a high-performance cross-platform desktop application and command-line utility built in **100% Rust and Tauri v2**. It recursively resolves mod dependency trees, fetches compatibility requirements, and downloads full modpacks in parallel—**no browser drivers, no python scripts, and no login required**.

Simply paste a Factorio Mod Portal URL or mod ID, inspect version constraints and optional dependencies, and click **Download All**.

> **Note**: *If you love Factorio, please support Wube Software by purchasing the game at [factorio.com](https://factorio.com).*

---

## ✨ Features

- **🚀 100% Native Rust Performance**: Built with a modular Rust workspace (`factorio`, `parser`, `downloader`, `cli`, and `gui`) replacing legacy Python scripts. Zero browser automation drivers needed.
- **🌳 Recursive Dependency Graph Resolver**: Automatically resolves required and recommended dependencies for complex overhauls (such as *Krastorio 2*, *Space Age*, *Freight Forwarding*, etc.).
- **⚙️ Custom Version Selection & Dependency Toggles**: Fine-tune specific mod version releases and toggle optional or recommended dependencies on/off per mod.
- **🔄 Parallel Download Manager**: Multi-threaded parallel downloading with streaming speed indicators, exact file sizes, and 15-second inactivity timeout guards.
- **🔁 Auto-Retry & Recovery**: Automatic 3-attempt retry loop for interrupted downloads, plus manual one-click **Retry** buttons for failed items.
- **🛡️ Internal Category Protection**: Auto-deletion rules for installed mods protect standalone overhaul/content mods (*Krastorio 2*, etc.) while safely cleaning up sub-libraries marked as `internal`.
- **🚫 Built-in Game Feature Filtering**: Excludes internal game features (`base`, `space-age`, `quality`, `elevated-rails`, `recycler`) from online fetching.
- **💻 Desktop GUI & CLI**: Feature-rich glassmorphic Tauri v2 GUI plus a standalone Rust CLI binary (`apps/cli`).
- **🌐 Cross-Platform Executables**: Native support for **Windows (x64)**, **macOS (Universal / Apple Silicon & Intel)**, and **Linux (x86_64 AppImage & deb)**.

---

## 🖥️ How to Use (GUI)

1. Download the latest installer/binary for your OS from the [Releases](https://github.com/vaibhavvikas/factorio-mod-downloader/releases/latest) page.
2. Launch **Factorio Mod Downloader**.
3. Set your target **Mods Folder** (automatically detected on boot).
4. Paste a mod URL (e.g., `https://mods.factorio.com/mod/Krastorio2`) or type a mod name in the **Mod Queue**.
5. Adjust versions or optional dependencies if needed, then click **Download All**.
6. Monitor progress in real time via the **Download Manager** drawer!

---

## 🛠️ Project Workspace Architecture

```
.
├── apps/
│   ├── cli/             # Standalone Rust CLI runner
│   └── gui/ui/          # Tauri v2 Desktop GUI (Rust + React + Vite + TailwindCSS)
├── crates/
│   ├── factorio/        # Factorio Mod Portal API client & dependency graph resolver
│   ├── parser/          # Info.json dependency parser & version constraint evaluator
│   └── downloader/      # Multi-threaded parallel downloader engine with timeout/retries
└── Cargo.toml           # Root Cargo workspace manifest
```

---

## 🏗️ Building from Source

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (1.75+)
- [Node.js](https://nodejs.org/) (v24+)
- Platform build toolchains (Xcode tools for macOS, Visual Studio C++ build tools for Windows, or `libgtk-3-dev` / `libwebkit2gtk-4.1-dev` for Linux).

### Build Desktop GUI
```bash
# Clone the repository
git clone https://github.com/vaibhavvikas/factorio-mod-downloader.git
cd factorio-mod-downloader/apps/gui/ui

# Install npm dependencies
npm install

# Run in Development Mode
npm run tauri dev

# Build Production Bundle
npm run tauri build
```

### Build CLI
```bash
cargo build --release --bin factorio-mod-downloader-cli
```

---

## 💳 Credits & Acknowledgments
- Factorio Mod Portal API & [Factorio.com](https://factorio.com) by Wube Software.
- Community storage mirrors by [re146.dev](https://re146.dev) & [@radioegor146](https://github.com/radioegor146).

---

## 📄 License
Distributed under the [MIT License](LICENSE).
