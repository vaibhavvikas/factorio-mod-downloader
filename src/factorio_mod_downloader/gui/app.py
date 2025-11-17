"""
Main Application Window for the Factorio Mod Downloader.
"""

import customtkinter

from factorio_mod_downloader.gui.frames import BodyFrame
from factorio_mod_downloader.gui.frames import DownloaderFrame
from factorio_mod_downloader.gui.utils import resource_path
from factorio_mod_downloader.infrastructure.config import ConfigManager
from factorio_mod_downloader.infrastructure.logger import LoggerSystem


customtkinter.set_appearance_mode("dark")
customtkinter.set_default_color_theme("blue")


class App(customtkinter.CTk):
    """Main application window."""

    def __init__(self):
        """Initialize the main application window."""
        super().__init__()
        self.resizable(0, 0)
        self.title("Factorio Mod Downloader v0.3.0")
        self.geometry(f"{1080}x{590}")

        try:
            self.iconbitmap(resource_path("factorio_downloader.ico"))
        except Exception as e:
            print(f"Warning: Could not load icon: {e}")

        # Initialize configuration and logging
        self.config_manager = ConfigManager()
        self.logger = LoggerSystem.from_config(self.config_manager.config)
        
        self.logger.info("Factorio Mod Downloader GUI started")

        self.grid_columnconfigure((0, 1), weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Create the downloader frame (right side - progress tracking)
        self.DownloaderFrame = DownloaderFrame(self, "Downloads")
        self.DownloaderFrame.grid(row=0, column=1, padx=(0, 10), pady=10, sticky="nsew")

        # Create the body frame (left side - input controls)
        self.BodyFrame = BodyFrame(self, self.DownloaderFrame)
        self.BodyFrame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        # Make references accessible for the downloader thread
        self.downloader_frame = self.DownloaderFrame
        self.progress_file = self.BodyFrame.progress_file
        self.progressbar = self.BodyFrame.progressbar
        self.download_button = self.BodyFrame.download_button
        self.textbox = self.BodyFrame.textbox
        
        # Load GUI preferences from config
        self._load_preferences()
        
        # Register cleanup on window close
        self.protocol("WM_DELETE_WINDOW", self._on_closing)
    
    def _load_preferences(self):
        """Load GUI preferences from configuration."""
        try:
            # Load default output path if configured
            default_path = self.config_manager.get('default_output_path')
            if default_path and default_path != './mods':
                self.BodyFrame.download_path.delete(0, 'end')
                self.BodyFrame.download_path.insert(0, default_path)
            
            # Load optional dependencies preference
            include_optional = self.config_manager.get('include_optional_deps')
            self.BodyFrame.optional_deps.set(include_optional)
            
            self.logger.info("GUI preferences loaded from configuration")
        except Exception as e:
            self.logger.warning(f"Could not load GUI preferences: {e}")
    
    def _save_preferences(self):
        """Save GUI preferences to configuration."""
        try:
            # Save download path if it's been set
            download_path = self.BodyFrame.download_path.get().strip()
            if download_path:
                self.config_manager.set('default_output_path', download_path, self.logger)
            
            # Save optional dependencies preference
            include_optional = self.BodyFrame.optional_deps.get()
            self.config_manager.set('include_optional_deps', include_optional, self.logger)
            
            # Save configuration to file
            self.config_manager.save_config()
            
            self.logger.info("GUI preferences saved to configuration")
        except Exception as e:
            self.logger.warning(f"Could not save GUI preferences: {e}")
    
    def _on_closing(self):
        """Handle window close event."""
        # Save preferences before closing
        self._save_preferences()
        
        self.logger.info("Factorio Mod Downloader GUI closed")
        
        # Destroy the window
        self.destroy()
