"""Core download engine for Factorio mods.

This module provides the main download orchestration that is independent
of both GUI and CLI interfaces.
"""

import os
import time
from dataclasses import dataclass
from typing import Callable, List, Optional, Set, Tuple

from factorio_mod_downloader.core.dependency_resolver import DependencyResolver
from factorio_mod_downloader.core.file_downloader import FileDownloader
from factorio_mod_downloader.core.mod_info_fetcher import ModInfo, ModInfoFetcher


@dataclass
class DownloadResult:
    """Result of a download operation."""
    success: bool
    downloaded_mods: List[str]
    failed_mods: List[Tuple[str, str]]  # (mod_name, error)
    total_size: int  # bytes
    duration: float  # seconds


@dataclass
class DownloadPlan:
    """Plan for a download operation (for dry-run)."""
    mods_to_download: List[ModInfo]
    total_count: int
    estimated_size: int  # bytes (if available)


class CoreDownloader:
    """Core download engine independent of UI.
    
    This class orchestrates the download process using ModInfoFetcher,
    DependencyResolver, and FileDownloader. It supports progress callbacks
    for UI updates and returns structured results.
    """
    
    def __init__(
        self,
        output_path: str,
        include_optional: bool,
        logger,
        config,
        progress_callback: Optional[Callable] = None
    ):
        """Initialize CoreDownloader.
        
        Args:
            output_path: Directory to save downloaded mods
            include_optional: Whether to include optional dependencies
            logger: LoggerSystem instance for logging
            config: Config object with settings
            progress_callback: Optional callback for progress updates.
                             Called with (event_type, data) where event_type is:
                             - 'analyzing': data = mod_name
                             - 'downloading': data = (mod_name, percentage, downloaded_mb, total_mb, speed_mbps)
                             - 'complete': data = mod_name
                             - 'error': data = (mod_name, error_message)
        """
        self.output_path = output_path
        self.include_optional = include_optional
        self.logger = logger
        self.config = config
        self.progress_callback = progress_callback
        
        # Initialize components
        self.mod_info_fetcher = ModInfoFetcher(logger, config)
        self.dependency_resolver = DependencyResolver(logger, config)
        self.file_downloader = FileDownloader(logger, config)
        
        # Track downloaded mods to avoid duplicates
        self.downloaded_mods: Set[str] = set()
    
    def download_mod(self, mod_url: str) -> DownloadResult:
        """Download a mod and its dependencies.
        
        Args:
            mod_url: URL of the mod to download
            
        Returns:
            DownloadResult with download statistics
        """
        start_time = time.time()
        downloaded = []
        failed = []
        total_size = 0
        
        try:
            # Notify analyzing
            if self.progress_callback:
                self.progress_callback('analyzing', mod_url.split('/')[-1])
            
            # Resolve dependencies
            self.logger.info(f"Resolving dependencies for {mod_url}")
            dep_tree = self.dependency_resolver.resolve_dependencies(
                mod_url,
                self.include_optional
            )
            
            # Get download list
            download_list = self.dependency_resolver.get_download_list(dep_tree)
            
            if not download_list:
                self.logger.warning("No mods to download")
                return DownloadResult(
                    success=True,
                    downloaded_mods=[],
                    failed_mods=[],
                    total_size=0,
                    duration=time.time() - start_time
                )
            
            self.logger.info(
                f"Found {len(download_list)} mods to download",
                count=len(download_list)
            )
            
            # Download each mod
            for mod_info in download_list:
                file_name = f"{mod_info.name}_{mod_info.version}.zip"
                
                # Skip if already downloaded
                if file_name in self.downloaded_mods:
                    self.logger.info(f"Mod already downloaded: {file_name}")
                    continue
                
                file_path = os.path.join(self.output_path, file_name)
                
                # Skip if file already exists
                if os.path.exists(file_path):
                    self.logger.info(f"File already exists: {file_path}")
                    self.downloaded_mods.add(file_name)
                    downloaded.append(file_name)
                    continue
                
                # Download the mod
                self.logger.info(f"Downloading {file_name}")
                
                # Create progress callback for this specific file
                def file_progress_callback(percentage, downloaded_mb, total_mb, speed):
                    if self.progress_callback:
                        self.progress_callback(
                            'downloading',
                            (mod_info.name, percentage, downloaded_mb, total_mb, speed)
                        )
                
                result = self.file_downloader.download_file(
                    mod_info.download_url,
                    file_path,
                    progress_callback=file_progress_callback,
                    resume=True
                )
                
                if result.success:
                    self.downloaded_mods.add(file_name)
                    downloaded.append(file_name)
                    total_size += result.size
                    
                    if self.progress_callback:
                        self.progress_callback('complete', mod_info.name)
                else:
                    failed.append((mod_info.name, result.error or "Unknown error"))
                    
                    if self.progress_callback:
                        self.progress_callback('error', (mod_info.name, result.error))
            
            duration = time.time() - start_time
            success = len(failed) == 0
            
            return DownloadResult(
                success=success,
                downloaded_mods=downloaded,
                failed_mods=failed,
                total_size=total_size,
                duration=duration
            )
            
        except Exception as e:
            self.logger.error(f"Error during download: {e}")
            duration = time.time() - start_time
            
            if self.progress_callback:
                self.progress_callback('error', (mod_url.split('/')[-1], str(e)))
            
            return DownloadResult(
                success=False,
                downloaded_mods=downloaded,
                failed_mods=failed + [(mod_url.split('/')[-1], str(e))],
                total_size=total_size,
                duration=duration
            )
    
    def get_download_plan(self, mod_url: str) -> DownloadPlan:
        """Get download plan without downloading (for dry-run).
        
        Analyzes dependencies and calculates what would be downloaded
        without actually performing the downloads.
        
        Args:
            mod_url: URL of the mod to analyze
            
        Returns:
            DownloadPlan with list of mods and estimated size
        """
        try:
            self.logger.info(f"Creating download plan for {mod_url}")
            
            # Resolve dependencies
            dep_tree = self.dependency_resolver.resolve_dependencies(
                mod_url,
                self.include_optional
            )
            
            # Get download list
            download_list = self.dependency_resolver.get_download_list(dep_tree)
            
            # Calculate estimated size (if available)
            estimated_size = sum(
                mod.size for mod in download_list if mod.size is not None
            )
            
            self.logger.info(
                f"Download plan created",
                mod_count=len(download_list),
                estimated_size_mb=f"{estimated_size / 1024 / 1024:.2f}" if estimated_size else "unknown"
            )
            
            return DownloadPlan(
                mods_to_download=download_list,
                total_count=len(download_list),
                estimated_size=estimated_size
            )
            
        except Exception as e:
            self.logger.error(f"Error creating download plan: {e}")
            raise
