"""Factorio Mod Downloader."""

__version__ = "0.3.0"

# Import the Rust extension
try:
    from . import factorio_mod_downloader_rust
    
    # Re-export main functions for easier access
    from .factorio_mod_downloader_rust import (
        DownloadResult,
        download_mod_with_deps,
        batch_download_mods,
        update_mod_list_json,
    )
    
    __all__ = [
        'factorio_mod_downloader_rust',
        'DownloadResult',
        'download_mod_with_deps',
        'batch_download_mods',
        'update_mod_list_json',
    ]
    
    # Flag to indicate Rust extension is available
    RUST_AVAILABLE = True
    
except ImportError as e:
    import warnings
    warnings.warn(
        f"Rust extension not available: {e}\n"
        "Some features may be slower. Run 'maturin develop' to build the Rust extension.",
        RuntimeWarning
    )
    
    RUST_AVAILABLE = False
    __all__ = []