import os
import re
import sys
import webbrowser
from pathlib import Path
from tkinter import END, Label

import customtkinter
from CTkMessagebox import CTkMessagebox

# Ensure Playwright downloads browsers to a persistent user directory
try:
    if sys.platform.startswith("win"):
        base_dir = os.environ.get("LOCALAPPDATA") or str(Path.home())
        browsers_dir = os.path.join(base_dir, "ms-playwright")
    else:
        # Fallbacks for non-Windows
        base_dir = os.environ.get("XDG_CACHE_HOME") or os.path.join(str(Path.home()), ".cache")
        browsers_dir = os.path.join(base_dir, "ms-playwright")
    os.makedirs(browsers_dir, exist_ok=True)
    # Only set if not already provided by the environment
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", browsers_dir)
except Exception:
    # Best-effort; continue even if directory setup fails
    pass

from factorio_mod_downloader.mod_downloader.mod_downloader import ModDownloader


customtkinter.set_appearance_mode("dark")
# Use Factorio orange color theme
customtkinter.set_default_color_theme("dark-blue")

# Define Factorio-inspired colors
FACTORIO_ORANGE = "#FF8C00"
FACTORIO_DARK_ORANGE = "#CC6600"
FACTORIO_LIGHT_ORANGE = "#FFA500"
FACTORIO_BG = "#2B2B2B"


def resource_path(relative_path):
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return relative_path


class App(customtkinter.CTk):
    def __init__(self):
        super().__init__()
        self.resizable(0, 0)
        self.title("Factorio Mod Downloader v1.0.0")
        self.geometry(f"{740}x{600}")
        self.iconbitmap(resource_path("factorio_downloader.ico"))

        self.frame_0 = customtkinter.CTkFrame(master=self)
        self.frame_0.pack(expand=True, pady=10, padx=10)
        self.frame_0.grid_rowconfigure(0, weight=1)
        self.frame_0.rowconfigure(4, weight=1)

        def select_path():
            output_path = customtkinter.filedialog.askdirectory()
            if output_path is not None and output_path != "":
                self.download_path.delete(0, END)
                self.download_path.insert(0, output_path)

        def callback(url):
            webbrowser.open_new(url)

        # Title Frame
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
        github_url = f"Made blazingly fast by Emmet, forked from vaibhavvikas, {github_repo}"
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
            lambda e: callback(
                "https://github.com/vaibhavvikas/factorio-mod-downloader"
            ),
        )
        self.developer_link = Label(self, text="Hyperlink", fg="blue", cursor="hand2")
        self.developer_link.bind(
            "<Button-1>",
            lambda e: callback(
                "https://github.com/vaibhavvikas/factorio-mod-downloader"
            ),
        )

        # Body Frame
        self.body_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.body_frame.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.body_frame.grid_rowconfigure(0, weight=1)
        self.body_frame.rowconfigure(3, weight=1)
        self.body_frame.columnconfigure(4, weight=1)

        self.mod_url = customtkinter.CTkEntry(
            self.body_frame, placeholder_text="Mod Url", width=500
        )
        self.mod_url.grid(
            row=0, column=0, columnspan=4, padx=10, pady=10, sticky="nsew"
        )

        self.download_path = customtkinter.CTkEntry(
            self.body_frame, placeholder_text="Download Path", width=500
        )
        self.download_path.grid(
            row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew"
        )

        self.path_button = customtkinter.CTkButton(
            master=self.body_frame,
            border_width=2,
            fg_color="transparent",
            text_color=(FACTORIO_ORANGE, FACTORIO_LIGHT_ORANGE),
            hover_color=FACTORIO_DARK_ORANGE,
            border_color=FACTORIO_ORANGE,
            text="Select Path",
            command=select_path,
        )
        self.path_button.grid(row=1, column=3, padx=10, pady=10, sticky="nsew")

        self.download_button = customtkinter.CTkButton(
            master=self.body_frame,
            text="Start Download",
            fg_color=FACTORIO_ORANGE,
            hover_color=FACTORIO_DARK_ORANGE,
            command=self.download_button_action,
        )
        self.download_button.grid(
            row=2, column=0, columnspan=4, padx=10, pady=10, sticky="nsew"
        )

        # Download Status and Progress Frame
        self.downloads_frame = customtkinter.CTkFrame(master=self.frame_0)
        self.downloads_frame.grid(row=2, column=0, padx=10, pady=(0, 10), sticky="nsew")

        # Overall status label
        self.progress_overall = customtkinter.CTkLabel(
            master=self.downloads_frame,
            text="Status: Ready",
            font=customtkinter.CTkFont(family="Tahoma", weight="bold"),
            text_color=("grey74", "grey60"),
        )
        self.progress_overall.grid(row=0, column=0, padx=12, pady=(5, 0), sticky="nsw")

        # Currently downloading label
        self.progress_file = customtkinter.CTkLabel(
            master=self.downloads_frame,
            text="Currently downloading: None",
            font=customtkinter.CTkFont(family="Tahoma", size=11),
            text_color=("grey74", "grey60"),
        )
        self.progress_file.grid(row=1, column=0, padx=12, pady=(0, 0), sticky="nsw")

        # Overall progress bar
        self.progressbar = customtkinter.CTkProgressBar(
            self.downloads_frame,
            orientation="horizontal",
            width=660,
            mode="indeterminate",
            indeterminate_speed=1,
            progress_color=FACTORIO_ORANGE,
            fg_color=FACTORIO_BG,
        )
        self.progressbar.grid(
            row=2, column=0, padx=(10, 10), pady=(10, 10), sticky="ew"
        )
        self.progressbar.start()

        # Logs Frame
        self.textbox = customtkinter.CTkTextbox(
            master=self.frame_0,
            border_width=0,
            width=680,
            font=customtkinter.CTkFont(family="Tahoma"),
        )
        self.textbox.grid(row=3, column=0, padx=10, pady=(0, 10), sticky="nsew")
        self.textbox.insert("0.0", "Factorio Mod Downloader v0.2.2:\n")
        self.textbox.yview(END)
        self.textbox.configure(state="disabled")

    def download_button_action(self):
        mod_url = self.mod_url.get()
        mod_url = mod_url.strip()

        download_path = self.download_path.get()
        download_path = download_path.strip()

        if not mod_url or (
            mod_url
            and re.match(r"^https://mods\.factorio\.com/mod/.*", mod_url.strip())
            is None
        ):
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message="Please provide a valid mod_url!!!",
                icon="cancel",
            )
            return

        if not download_path:
            CTkMessagebox(
                title="Error",
                width=500,
                message="Please provide a valid download_path!!!",
                icon="cancel",
            )
            return

        self.download_button.configure(state="disabled", text="Download Started")
        download_path = f"{download_path}/mods"
        output = Path(download_path).expanduser().resolve()

        if output.exists() and not output.is_dir():
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"{output} already exists and is not a directory.\n"
                "Enter a valid output directory.",
            )
            self.download_button.configure(state="normal", text="Start Download")
            return

        if output.exists() and output.is_dir() and tuple(output.glob("*")):
            response = CTkMessagebox(
                title="Continue?",
                width=500,
                wraplength=500,
                message=f"Directory {output} is not empty.\n"
                "Do you want to continue and overwrite?",
                icon="warning",
                option_1="Cancel",
                option_2="Yes",
            )

            if not response or (response and response.get() != "Yes"):
                self.download_button.configure(state="normal", text="Start Download")
                return

        os.makedirs(download_path, exist_ok=True)
        try:
            mod_downloader = ModDownloader(mod_url, download_path, self)
            mod_downloader.start()
        except Exception as e:
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Unknown error occured.\n{str(e).split("\n")[0]}",
            )
        return


def main():
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
