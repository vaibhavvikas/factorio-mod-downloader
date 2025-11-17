"""
Main downloader module for Factorio mods with dependency resolution.

This module provides a GUI-compatible wrapper around CoreDownloader.
"""

import os
from threading import Thread
from typing import Final

from CTkMessagebox import CTkMessagebox

from factorio_mod_downloader.core.downloader import CoreDownloader
from factorio_mod_downloader.infrastructure.config import Config
from factorio_mod_downloader.infrastructure.logger import LoggerSystem


# API Constants
BASE_FACTORIO_MOD_URL: Final = "https://mods.factorio.com/mod"
BASE_MOD_URL: Final = "https://re146.dev/factorio/mods/en#"


class ModDownloader(Thread):
    """Thread-based mod downloader with dependency resolution.
    
    This class wraps CoreDownloader to provide GUI-compatible functionality.
    """

    def __init__(self, mod_url: str, output_path: str, app, logger=None, config=None):
        """
        Initialize the mod downloader.

        Args:
            mod_url: URL of the mod to download
            output_path: Directory to save downloaded mods
            app: Reference to the GUI application
            logger: Optional LoggerSystem instance for structured logging
            config: Optional Config instance for settings
        """
        super().__init__()
        self.daemon = True
        self.output_path = output_path
        self.mod = mod_url.split("/")[-1]  # Extract mod name from URL
        self.mod_url = BASE_MOD_URL + mod_url
        self.app = app
        
        # Initialize logger if not provided
        if logger is None:
            self.logger = LoggerSystem(log_level='INFO')
        else:
            self.logger = logger
        
        # Initialize config if not provided
        if config is None:
            self.config = Config()
        else:
            self.config = config
        
        self.include_optional = self.app.optional_deps.get()
        
        # Track active download entries for progress updates
        self.active_downloads = {}

    def run(self):
        """Execute the download process using CoreDownloader."""
        try:
            self.log_info(f"Loading mod {self.mod}.\n")
            
            # Update UI to show starting
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(text=f"Starting download for {self.mod}...")
            )
            
            # Create output directory
            os.makedirs(self.output_path, exist_ok=True)
            
            # Create CoreDownloader with progress callback
            core_downloader = CoreDownloader(
                output_path=self.output_path,
                include_optional=self.include_optional,
                logger=self.logger,
                config=self.config,
                progress_callback=self._handle_progress
            )
            
            # Download the mod and its dependencies
            result = core_downloader.download_mod(self.mod_url)
            
            # Check result and show appropriate message
            if result.success:
                self.log_info("All mods downloaded successfully.\n")
                self.app.progress_file.after(
                    0,
                    lambda: self.app.progress_file.configure(text="All mods downloaded successfully."),
                )
                
                CTkMessagebox(
                    title="Download Completed",
                    width=500,
                    wraplength=500,
                    message=f"Successfully downloaded {len(result.downloaded_mods)} mod(s).",
                    icon="check",
                    option_1="Ok",
                )
            else:
                # Some downloads failed
                error_msg = f"Downloaded {len(result.downloaded_mods)} mod(s), but {len(result.failed_mods)} failed."
                self.log_info(f"{error_msg}\n")
                
                for mod_name, error in result.failed_mods:
                    self.log_info(f"Failed: {mod_name} - {error}\n")
                
                CTkMessagebox(
                    title="Download Completed with Errors",
                    width=500,
                    wraplength=500,
                    message=error_msg,
                    icon="warning",
                    option_1="Ok",
                )

        except Exception as e:
            error_msg = str(e).split("\n")[0]
            self.log_info(f"Error: {error_msg}\n")

            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Download failed.\n{error_msg}",
                icon="cancel",
            )

            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(text="Start download to see progress."),
            )

        finally:
            self.app.download_button.configure(state="normal", text="Start Download")
            self.app.path_button.configure(state="normal")

    def _handle_progress(self, event_type: str, data):
        """Handle progress callbacks from CoreDownloader.
        
        Args:
            event_type: Type of progress event ('analyzing', 'downloading', 'complete', 'error')
            data: Event-specific data
        """
        if event_type == 'analyzing':
            # data is mod_name
            mod_name = data
            self.log_info(f"Analyzing mod {mod_name}...\n")
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(text=f"Analyzing mod {mod_name}")
            )
            
        elif event_type == 'downloading':
            # data is (mod_name, percentage, downloaded_mb, total_mb, speed_mbps)
            mod_name, percentage, downloaded_mb, total_mb, speed = data
            
            # Create download entry if it doesn't exist
            if mod_name not in self.active_downloads:
                file_name = f"{mod_name}"
                entry = self.app.downloader_frame.add_download(file_name)
                self.active_downloads[mod_name] = entry
                self.log_info(f"Downloading {mod_name}...\n")
            
            # Update progress
            entry = self.active_downloads[mod_name]
            entry.progress_bar.after(
                0,
                lambda: entry.update_progress(percentage, downloaded_mb, total_mb, speed)
            )
            
        elif event_type == 'complete':
            # data is mod_name
            mod_name = data
            
            if mod_name in self.active_downloads:
                entry = self.active_downloads[mod_name]
                entry.text_label.after(0, entry.mark_complete)
            
            self.log_info(f"Completed: {mod_name}\n")
            
        elif event_type == 'error':
            # data is (mod_name, error_message)
            mod_name, error_message = data
            
            if mod_name in self.active_downloads:
                entry = self.active_downloads[mod_name]
                entry.text_label.after(0, lambda: entry.mark_failed(error_message))
            
            self.log_info(f"Error downloading {mod_name}: {error_message}\n")
    
    def log_info(self, info: str):
        """
        Append text to the application's log textbox and structured logger.

        Args:
            info: Text to log
        """
        # Log to GUI textbox
        self.app.textbox.configure(state="normal")
        self.app.textbox.insert("end", info)
        self.app.textbox.yview("end")
        self.app.textbox.configure(state="disabled")
        
        # Log to structured logger
        # Remove trailing newline for cleaner log entries
        message = info.rstrip('\n')
        if message:
            self.logger.info(message)
