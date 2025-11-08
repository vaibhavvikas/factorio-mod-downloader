"""
Main Application Window for the Factorio Mod Downloader.
"""

import customtkinter

from factorio_mod_downloader.gui.frames import BodyFrame
from factorio_mod_downloader.gui.frames import DownloaderFrame
from factorio_mod_downloader.gui.utils import resource_path


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
