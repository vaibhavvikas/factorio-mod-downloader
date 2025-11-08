import os
import re
import sys
import webbrowser
from pathlib import Path
from tkinter import END, Label

import customtkinter
from CTkMessagebox import CTkMessagebox
from factorio_mod_downloader.mod_downloader.mod_downloader import ModDownloader

customtkinter.set_appearance_mode("dark")
customtkinter.set_default_color_theme("blue")

def resource_path(relative_path):
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return relative_path


class DownloadEntry:
    def __init__(self, frame, label_widget, progress_bar):
        self.frame = frame
        self.label = label_widget
        self.progress_bar = progress_bar

class App(customtkinter.CTk):
    def __init__(self):
        super().__init__()
        self.resizable(0, 0)
        self.title("Factorio Mod Downloader v0.3.0")
        self.geometry(f"{1080}x{560}")
        self.iconbitmap(resource_path("factorio_downloader.ico"))

        self.grid_columnconfigure((0, 1), weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.DownloaderFrame = DownloaderFrame(self, "downloads")
        self.DownloaderFrame.grid(row=0, column=1, padx=(0, 10), pady=10, sticky="nsew")

        self.BodyFrame = BodyFrame(self, self.DownloaderFrame)
        self.BodyFrame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")

       

class DownloaderFrame(customtkinter.CTkScrollableFrame):
    def __init__(self, master, title):
        super().__init__(master, label_text=title, height=100, width=300)
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.frames = []
        # Main container frame for added frames
        self.container = customtkinter.CTkFrame(self)
        self.container.pack(padx=10, pady=10)

    def _setup_downloads_frame(self, label):
        """Setup progress tracking section"""
        downloads_frame = customtkinter.CTkFrame(master=self.container)
        # downloads_frame.grid(row=2, column=0, padx=10, pady=(0, 10), sticky="nsew")

        progress_file = customtkinter.CTkLabel(
            master=downloads_frame,
            text=f"{label}",
            font=customtkinter.CTkFont(family="Tahoma"),
            text_color=("grey74", "grey60"),
            wraplength=250,
        )
        progress_file.pack(side="top", anchor="w", padx=12, pady=(2,0))

        progress_bar = customtkinter.CTkProgressBar(
            downloads_frame,
            orientation="horizontal",
            width=660,
            mode="determinate",
        )
        progress_bar.pack(side="top", fill="x", padx=12, pady=(6,10), anchor="w")

        return downloads_frame, progress_file, progress_bar

    def add_download(self, label):
        # Create a new frame with a label and a button (for demonstration)
        frame, label_widget, progress_bar = self._setup_downloads_frame(label)
        frame.pack(fill="x", pady=5)
        # Store reference for further logic if needed
        entry = DownloadEntry(frame, label_widget, progress_bar)
        self.frames.append(entry)
        return entry


class BodyFrame(customtkinter.CTkFrame):
    def __init__(self, master, downloader_frame):
        super().__init__(master)
        self.frame_0 = customtkinter.CTkFrame(master=self)
        self.frame_0.pack(expand=True, pady=10, padx=10)
        self.frame_0.grid_rowconfigure(0, weight=1)
        self.frame_0.rowconfigure(5, weight=1)
        self.downloader_frame = downloader_frame
        self._setup_ui()
        
    def _setup_ui(self):
        """Initialize UI components"""
        self._setup_title_frame()
        self._setup_body_frame()
        self._setup_downloads_frame()
        self._setup_textbox()

    def _setup_title_frame(self):
        """Setup title section"""
        self.title_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.title_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.title_frame.grid_rowconfigure(0, weight=1)
        self.title_frame.rowconfigure(3, weight=1)

        self.title_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text="Factorio Mod Downloader",
            font=customtkinter.CTkFont(family="Tahoma", size=20, weight="bold"),
        )
        self.title_label.grid(row=0, padx=10, sticky="nsw")

        self.title_sub_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text="One Downloader for all your factorio mods.",
            font=customtkinter.CTkFont(family="Tahoma"),
            text_color=("grey74", "grey60"),
        )
        self.title_sub_label.grid(row=1, padx=12, sticky="nsw")

        github_repo = "https://github.com/vaibhavvikas/factorio-mod-downloader"
        github_url = f"Made with ♥ by Vaibhav Vikas, {github_repo}"

        self.developer_label = customtkinter.CTkLabel(
            master=self.title_frame,
            text=github_url,
            font=customtkinter.CTkFont(family="Tahoma"),
            text_color=("grey60", "grey74"),
            cursor="hand2",
        )
        self.developer_label.grid(row=2, padx=12, sticky="nsw")
        self.developer_label.bind(
            "<Button-1>",
            lambda e: self._callback(
                "https://github.com/vaibhavvikas/factorio-mod-downloader"
            ),
        )

    def _setup_body_frame(self):
        """Setup input controls section"""
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
        self.download_path.grid(row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        self.path_button = customtkinter.CTkButton(
            master=self.body_frame,
            border_width=2,
            fg_color="transparent",
            text_color=("gray10", "#DCE4EE"),
            text="Select Path",
            command=self._select_path,
        )
        self.path_button.grid(row=1, column=3, padx=10, pady=10, sticky="nsew")


        self.download_button = customtkinter.CTkButton(
            master=self.body_frame,
            text="Start Download",
            command=self._download_button_action,
        )
        self.download_button.grid(row=2, column=0, columnspan=4, padx=10, pady=10, sticky="nsew")

    def _setup_downloads_frame(self):
        """Setup progress tracking section"""
        self.downloads_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.downloads_frame.grid(row=2, column=0, padx=10, pady=(0, 10), sticky="nsew")

        self.progress_file = customtkinter.CTkLabel(
            master=self.downloads_frame,
            text="Start download to see progress.",
            font=customtkinter.CTkFont(family="Tahoma"),
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
        self.progressbar.grid(row=1, column=0, padx=(10, 10), pady=(10, 10), sticky="ns")
        self.progressbar.start()

    def _setup_textbox(self):
        """Setup logs section"""
        self.textbox = customtkinter.CTkTextbox(
            master=self.frame_0,
            border_width=0,
            width=680,
            font=customtkinter.CTkFont(family="Tahoma"),
        )
        self.textbox.grid(row=3, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.textbox.insert("0.0", "Factorio Mod Downloader v0.3.0:\n")
        self.textbox.yview(END)
        self.textbox.configure(state="disabled")

    def _select_path(self):
        """Handle path selection"""
        output_path = customtkinter.filedialog.askdirectory()
        if output_path and output_path != "":
            self.download_path.delete(0, END)
            self.download_path.insert(0, output_path)
        

    def _open_path(self):
        """Handle path open in explorer"""
        output_path = customtkinter.filedialog.opendirectory()

    def _callback(self, url):
        """Open URL in browser"""
        webbrowser.open_new(url)

    def _validate_inputs(self) -> bool:
        """Validate user inputs"""
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
        """Handle download button click"""
        if not self._validate_inputs():
            return

        self.download_button.configure(state="disabled", text="Download Started")
        download_path = self.download_path.get().strip()
        mod_url = self.mod_url.get().strip()

        os.makedirs(download_path, exist_ok=True)

        try:
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

def main():
    app = App()
    app.mainloop()

if __name__ == "__main__":
    main()
