"""Rust-powered download engine wrapper."""

import os
from pathlib import Path
from typing import List, Optional, Tuple
from dataclasses import dataclass

try:
    import factorio_mod_downloader_rust as rust_module
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False


@dataclass
class RustDownloadResult:
    """Result from Rust download operation."""
    success: bool
    downloaded_mods: List[str]
    failed_mods: List[Tuple[str, str]]
    total_size: int
    duration: float


class RustDownloader:
    """Wrapper for Rust download functions."""
    
    def __init__(self, logger, config):
        self.logger = logger
        self.config = config
        
        if not RUST_AVAILABLE:
            raise ImportError(
                "Rust module not available. Please build the Rust extension first."
            )
    
    def download_mod(
        self,
        mod_url: str,
        output_path: str,
        factorio_version: str = "2.0",
        include_optional: bool = True,
        include_optional_all: bool = False,
        target_mod_version: Optional[str] = None,
        max_depth: int = 10
    ) -> RustDownloadResult:
        """Download a mod with dependencies using Rust."""
        self.logger.debug(f"Using Rust downloader for: {mod_url}")
        
        result = rust_module.download_mod_with_deps(
            mod_url=mod_url,
            output_path=output_path,
            factorio_version=factorio_version,
            include_optional=include_optional,
            include_optional_all=include_optional_all,
            target_mod_version=target_mod_version,
            max_depth=max_depth
        )
        
        return RustDownloadResult(
            success=result.success,
            downloaded_mods=result.downloaded_mods,
            failed_mods=result.failed_mods,
            total_size=result.total_size,
            duration=result.duration
        )

    def batch_download(
        self,
        mod_urls: List[str],
        output_path: str,
        factorio_version: str = "2.0",
        include_optional: bool = True,
        include_optional_all: bool = False,
        max_depth: int = 10,
        continue_on_error: bool = True
    ) -> RustDownloadResult:
        """Batch download multiple mods using Rust."""
        self.logger.debug(f"Using Rust batch downloader for {len(mod_urls)} mods")
        
        result = rust_module.batch_download_mods(
            mod_urls=mod_urls,
            output_path=output_path,
            factorio_version=factorio_version,
            _include_optional=include_optional,
            _include_optional_all=include_optional_all,
            _max_depth=max_depth,
            continue_on_error=continue_on_error
        )
        
        return RustDownloadResult(
            success=result.success,
            downloaded_mods=result.downloaded_mods,
            failed_mods=result.failed_mods,
            total_size=result.total_size,
            duration=result.duration
        )
    
    def download_mod_enhanced(
        self,
        mod_url: str,
        output_path: str,
        factorio_version: str = "2.0",
        include_optional: bool = True,
        include_optional_all: bool = False,
        target_mod_version: Optional[str] = None,
        max_depth: int = 10
    ) -> RustDownloadResult:
        """Download a mod with dependencies using enhanced Rust downloader with beautiful progress bars."""
        self.logger.debug(f"Using enhanced Rust downloader for: {mod_url}")
        
        result = rust_module.download_mod_with_deps_enhanced(
            mod_url=mod_url,
            output_path=output_path,
            factorio_version=factorio_version,
            include_optional=include_optional,
            include_optional_all=include_optional_all,
            target_mod_version=target_mod_version,
            max_depth=max_depth
        )
        
        return RustDownloadResult(
            success=result.success,
            downloaded_mods=result.downloaded_mods,
            failed_mods=result.failed_mods,
            total_size=result.total_size,
            duration=result.duration
        )
    
    def batch_download_enhanced(
        self,
        mod_urls: List[str],
        output_path: str,
        factorio_version: str = "2.0",
        include_optional: bool = True,
        include_optional_all: bool = False,
        max_depth: int = 10,
        continue_on_error: bool = True
    ) -> RustDownloadResult:
        """Batch download multiple mods using enhanced Rust downloader with beautiful progress bars."""
        self.logger.debug(f"Using enhanced Rust batch downloader for {len(mod_urls)} mods")
        
        result = rust_module.batch_download_mods_enhanced(
            mod_urls=mod_urls,
            output_path=output_path,
            factorio_version=factorio_version,
            include_optional=include_optional,
            include_optional_all=include_optional_all,
            max_depth=max_depth,
            continue_on_error=continue_on_error
        )
        
        return RustDownloadResult(
            success=result.success,
            downloaded_mods=result.downloaded_mods,
            failed_mods=result.failed_mods,
            total_size=result.total_size,
            duration=result.duration
        )
    
    def update_mod_list_json(
        self,
        mod_names: List[str],
        mods_directory: str,
        enabled: bool = True
    ) -> bool:
        """Update mod-list.json with downloaded mods."""
        return rust_module.update_mod_list_json(
            mod_names=mod_names,
            mods_directory=mods_directory,
            enabled=enabled
        )
