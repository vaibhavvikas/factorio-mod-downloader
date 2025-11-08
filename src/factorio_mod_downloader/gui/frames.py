"""
GUI Components and Frames for the Factorio Mod Downloader.
"""

import re
import webbrowser
from pathlib import Path
from tkinter import END
from tkinter import filedialog

import customtkinter
from CTkMessagebox import CTkMessagebox
from PIL import Image

from factorio_mod_downloader.gui.utils import resource_path


download_icon = customtkinter.CTkImage(Image.open(resource_path("icons/download.png")), size=(16, 16))
success_icon = customtkinter.CTkImage(Image.open(resource_path("icons/check.png")), size=(16, 16))
error_icon = customtkinter.CTkImage(Image.open(resource_path("icons/error.png")), size=(16, 16))
warning_icon = customtkinter.CTkImage(Image.open(resource_path("icons/warning.png")), size=(16, 16))


class DownloadEntry:
    """Represents a single download entry with status and progress."""

    def __init__(self, file_name, frame, icon_label, text_label, sub_label, progress_bar):
        self.file_name = file_name
        self.frame = frame
        self.icon_label = icon_label
        self.text_label = text_label
        self.sub_label = sub_label
        self.progress_bar = progress_bar

    def update_progress(self, percent: float, downloaded_mb: float, total_mb: float, speed: float):
        """Update progress visuals."""
        self.progress_bar.set(percent)
        self.sub_label.configure(
            text=f"{percent * 100:.1f}% — {downloaded_mb:.1f} MB / {total_mb:.1f} MB @ {speed:.1f} MB/s"
        )

    def mark_complete(self):
        """Mark the download as complete."""
        self.icon_label.configure(image=success_icon)
        self.sub_label.configure(text="Completed successfully.")
        self.progress_bar.set(1.0)
        self.progress_bar.configure(progress_color="#4CAF50")  # green

    def mark_failed(self, error_msg: str):
        """Mark the download as failed."""
        self.icon_label.configure(image=error_icon)
        self.sub_label.configure(text=f"Error: {error_msg}")
        self.progress_bar.configure(progress_color="#F44336")  # red

    def mark_warning(self, error_msg: str):
        self.icon_label.configure(image=warning_icon)

    def mark_retrying(self, attempt: int, max_attempts: int):
        """Mark the download as retrying."""
        self.icon_label.configure(image=warning_icon)  # orange warning icon
        self.sub_label.configure(text=f"Retrying... ({attempt}/{max_attempts})")
        self.progress_bar.configure(progress_color="#FFA500")


class DownloaderFrame(customtkinter.CTkScrollableFrame):
    """Scrollable frame displaying active downloads with progress bars."""

    def __init__(self, master, title):
        super().__init__(master, height=500, width=300, label_text=title)
        self.grid_columnconfigure(0, weight=1)
        self.frames = []

        self.container = customtkinter.CTkFrame(self)
        self.container.pack(expand=True, fill="both", padx=5)

    def _setup_downloads_frame(self, label: str):
        """Setup the UI for one download entry, inside a bordered box."""
        downloads_frame = customtkinter.CTkFrame(master=self.container)
        downloads_frame.pack(fill="x", pady=5)  # more padding for separation

        label_container = customtkinter.CTkFrame(master=downloads_frame, fg_color="transparent")
        label_container.pack(side="top", fill="x", padx=12, pady=(6, 0))

        icon_label = customtkinter.CTkLabel(master=label_container, image=download_icon, text="")
        icon_label.pack(side="left")

        # File name label
        text_label = customtkinter.CTkLabel(
            master=label_container,
            text=f"{label}",
            font=customtkinter.CTkFont(family="Segoe UI Emoji", weight="bold"),
            anchor="w",
            justify="left",
        )
        text_label.pack(side="left", padx=(8, 0), fill="x", expand=True)

        # Subtext for progress details
        sub_label = customtkinter.CTkLabel(
            master=downloads_frame,
            text="Starting...",
            font=customtkinter.CTkFont(family="Segoe UI", size=11),
            text_color=("grey80", "grey60"),
            anchor="w",
            justify="left",
        )
        sub_label.pack(side="top", fill="x", padx=12, pady=(0, 0))

        # Progress bar
        progress_bar = customtkinter.CTkProgressBar(
            downloads_frame,
            orientation="horizontal",
            width=260,
            mode="determinate",
        )
        progress_bar.set(0)
        progress_bar.pack(side="top", fill="x", padx=12, pady=(4, 10))

        return downloads_frame, icon_label, text_label, sub_label, progress_bar

    def add_download(self, file_name: str):
        """Add a new download entry."""
        frame, icon_label, text_label, sub_label, progress_bar = self._setup_downloads_frame(file_name)
        entry = DownloadEntry(file_name, frame, icon_label, text_label, sub_label, progress_bar)
        self.frames.append(entry)
        self.update_idletasks()

        try:
            self._parent_canvas.yview_moveto(1.0)
        except Exception:
            pass

        return entry


class BodyFrame(customtkinter.CTkFrame):
    """Main content frame with input controls and download status."""

    def __init__(self, master, downloader_frame):
        """
        Initialize the body frame.

        Args:
            master: Parent widget (the main App)
            downloader_frame: Reference to the DownloaderFrame
        """
        super().__init__(master)
        self.frame_0 = customtkinter.CTkFrame(master=self)
        self.frame_0.pack(expand=True, pady=10, padx=10)
        self.frame_0.grid_rowconfigure(0, weight=1)
        self.frame_0.rowconfigure(5, weight=1)

        self.downloader_frame = downloader_frame
        self._setup_ui()

    def _setup_ui(self):
        """Initialize all UI components."""
        self._setup_title_frame()
        self._setup_body_frame()
        self._setup_downloads_frame()
        self._setup_textbox()

    def _setup_title_frame(self):
        """Setup title section with application info."""
        self.title_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.title_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

        self.title_frame.grid_rowconfigure(0, weight=1)
        self.title_frame.rowconfigure(3, weight=1)

        self.title_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text="Factorio Mod Downloader",
            font=customtkinter.CTkFont(family="Segoe UI Semibold", size=20, weight="bold"),
            anchor="w",
        )
        self.title_label.grid(row=0, padx=10, sticky="nsew")

        self.title_sub_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text="One Downloader for all your factorio mods.",
            font=customtkinter.CTkFont(family="Segoe UI"),
            text_color=("grey74", "grey60"),
        )
        self.title_sub_label.grid(row=1, padx=12, sticky="nsw")

        github_repo = "https://github.com/vaibhavvikas/factorio-mod-downloader"
        github_url = f"Made with ♥ by Vaibhav Vikas, {github_repo}"

        self.developer_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text=github_url,
            font=customtkinter.CTkFont(family="Segoe UI Emoji"),
            text_color=("grey60", "grey74"),
            cursor="hand2",
        )
        self.developer_label.grid(row=2, padx=12, sticky="nsw")
        self.developer_label.bind(
            "<Button-1>",
            lambda e: self._callback(github_repo),
        )

    def _setup_body_frame(self):
        """Setup input controls section."""
        self.body_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.body_frame.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.body_frame.grid_rowconfigure(0, weight=1)
        self.body_frame.rowconfigure(3, weight=1)
        self.body_frame.columnconfigure(4, weight=1)

        self.mod_url = customtkinter.CTkEntry(
            self.body_frame, placeholder_text="Mod Url", width=500
        )
        self.mod_url.grid(row=0, column=0, columnspan=4, padx=10, pady=10, sticky="nsew")

        self.download_path = customtkinter.CTkEntry(
            self.body_frame, placeholder_text="Download Path", width=500
        )
        self.download_path.grid(row=1, column=0, columnspan=3, padx=10, pady=(0, 10), sticky="nsew")

        self.path_button = customtkinter.CTkButton(
            master=self.body_frame,
            border_width=2,
            fg_color="transparent",
            text_color=("gray10", "#DCE4EE"),
            text="Select Path",
            command=self._select_path,
        )
        self.path_button.grid(row=1, column=3, padx=10, pady=(0, 10), sticky="nsew")

        optional_deps_container = customtkinter.CTkFrame(
            master=self.body_frame, fg_color="transparent"
        )
        optional_deps_container.grid(
            row=2, column=0, columnspan=4, padx=10, pady=(0, 10), sticky="nsew"
        )

        self.optional_deps = customtkinter.BooleanVar(value=False)
        self.optional_deps_checkbox = customtkinter.CTkCheckBox(
            master=optional_deps_container,
            text="",
            width=24,
            variable=self.optional_deps,
            font=customtkinter.CTkFont(family="Segoe UI"),
        )
        self.optional_deps_checkbox.pack(side="left", padx=(0, 0))

        icon_label = customtkinter.CTkLabel(
            master=optional_deps_container, image=warning_icon, text=""
        )
        icon_label.pack(side="left")

        text_label = customtkinter.CTkLabel(
            master=optional_deps_container,
            text=f"Download optional dependencies (may significantly increase the number and size of downloads).",
            font=customtkinter.CTkFont(family="Segoe UI"),
            anchor="w",
            justify="left",
        )
        text_label.pack(side="left", padx=(8, 0), fill="x", expand=True)

        self.download_button = customtkinter.CTkButton(
            master=self.body_frame,
            text="Start Download",
            command=self._download_button_action,
            fg_color=["#3a7ebf", "#1f538d"],
            hover_color=["#325882", "#14375e"],
            border_color=["#3E454A", "#949A9F"],
            text_color=["#DCE4EE", "#DCE4EE"],
            text_color_disabled=["gray74", "gray60"],
        )
        self.download_button.grid(
            row=3, column=0, columnspan=4, padx=10, pady=(0, 10), sticky="nsew"
        )

    def _setup_downloads_frame(self):
        """Setup progress tracking section."""
        self.downloads_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.downloads_frame.grid(row=2, column=0, padx=10, pady=(0, 10), sticky="nsew")

        self.progress_file = customtkinter.CTkLabel(
            master=self.downloads_frame,
            text="Start download to see progress.",
            font=customtkinter.CTkFont(family="Segoe UI"),
            text_color=("grey74", "grey60"),
        )
        self.progress_file.grid(row=0, padx=12, sticky="nsw")

        self.progressbar = customtkinter.CTkProgressBar(
            self.downloads_frame,
            orientation="horizontal",
            width=660,
            mode="indeterminate",
            indeterminate_speed=1,
        )
        self.progressbar.grid(row=1, column=0, padx=(10, 10), pady=(5, 10), sticky="ns")
        self.progressbar.start()

    def _setup_textbox(self):
        """Setup logs section."""
        self.textbox = customtkinter.CTkTextbox(
            master=self.frame_0,
            border_width=0,
            width=680,
            font=customtkinter.CTkFont(family="Cascadia Mono"),
        )
        self.textbox.grid(row=3, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.textbox.insert("0.0", "Factorio Mod Downloader v0.3.0:\n")
        self.textbox.yview(END)
        self.textbox.configure(state="disabled")

    def _select_path(self):
        """Handle path selection."""
        output_path = filedialog.askdirectory()
        if output_path and output_path != "":
            self.download_path.delete(0, END)
            self.download_path.insert(0, output_path)

    def _callback(self, url):
        """Open URL in browser."""
        webbrowser.open_new(url)

    def _validate_inputs(self) -> bool:
        """
        Validate user inputs.

        Returns:
            True if inputs are valid, False otherwise
        """
        mod_url = self.mod_url.get().strip()
        download_path = self.download_path.get().strip()

        if not mod_url or not re.match(r"^https://mods\.factorio\.com/mod/.*", mod_url):
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message="Please provide a valid mod_url!!!",
                icon="cancel",
            )
            return False

        if not download_path:
            CTkMessagebox(
                title="Error",
                width=500,
                message="Please provide a valid download_path!!!",
                icon="cancel",
            )
            return False

        output = Path(download_path).expanduser().resolve()

        if output.exists() and not output.is_dir():
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"{output} already exists and is not a directory.\nEnter a valid output directory.",
                icon="cancel",
            )
            return False

        if output.exists() and output.is_dir() and tuple(output.glob("*")):
            response = CTkMessagebox(
                title="Continue?",
                width=500,
                wraplength=500,
                message=f"Directory {output} is not empty.\nDo you want to continue and overwrite?",
                icon="warning",
                option_1="Cancel",
                option_2="Yes",
            )

            if not response or response.get() != "Yes":
                return False

        return True

    def _download_button_action(self):
        """Handle download button click."""
        if not self._validate_inputs():
            return

        self.download_button.configure(state="disabled", text="Download Started")
        self.path_button.configure(state="disabled")
        download_path = self.download_path.get().strip()
        mod_url = self.mod_url.get().strip()

        import os

        os.makedirs(download_path, exist_ok=True)

        try:
            # Import here to avoid circular imports
            from factorio_mod_downloader.downloader.mod_downloader import ModDownloader

            mod_downloader = ModDownloader(mod_url, download_path, self)
            mod_downloader.start()

        except Exception as e:
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Unknown error occurred.\n{str(e).split(chr(10))[0]}",
                icon="cancel",
            )
            self.download_button.configure(state="normal", text="Start Download")
            self.path_button.configure(state="normal")
