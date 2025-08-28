import argparse
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


class App(customtkinter.CTk):
    def __init__(self, sources=None, destination=None):
        super().__init__()
        self.resizable(0, 0)
        self.title("Factorio Mod Downloader v0.2.2")
        self.geometry(f"{740}x{660}")
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

        self.mod_url_label = customtkinter.CTkLabel(
            master=self.body_frame,
            text="Mod URLs",
            font=customtkinter.CTkFont(family="Tahoma"),
            text_color=("grey74", "grey60"),
        )
        self.mod_url_label.grid(row=0, padx=10, sticky="nsw")

        self.mod_urls = customtkinter.CTkTextbox(master=self.body_frame, wrap="none", height=100)
        self.mod_urls.grid(row=1, column=0, columnspan=4, padx=10, pady=10, sticky="nsew")
        self.mod_urls.insert(f"1.0", "\n".join(sources))

        self.download_path = customtkinter.CTkEntry(
            self.body_frame, placeholder_text="Download Path", width=500
        )
        self.download_path.grid(
            row=2, column=0, columnspan=3, padx=10, pady=10, sticky="nsew"
        )
        if destination is not None:
            self.download_path.insert(0, destination)

        self.path_button = customtkinter.CTkButton(
            master=self.body_frame,
            border_width=2,
            fg_color="transparent",
            text_color=("gray10", "#DCE4EE"),
            text="Select Path",
            command=select_path,
        )
        self.path_button.grid(row=2, column=3, padx=10, pady=10, sticky="nsew")

        self.download_button = customtkinter.CTkButton(
            master=self.body_frame,
            text="Start Download",
            command=self.download_button_action,
        )
        self.download_button.grid(
            row=3, column=0, columnspan=4, padx=10, pady=10, sticky="nsew"
        )

        # Download Status and Progress Frame
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
        self.progressbar.grid(
            row=1, column=0, padx=(10, 10), pady=(10, 10), sticky="ns"
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

    def download_button_action(self, ignore_overwrite=False):
        mod_urls = [
            line.strip() 
            for line in self.mod_urls.get("1.0", END).split()
        ]

        download_path = self.download_path.get()
        download_path = download_path.strip()

        for mod_url in mod_urls:
            if not mod_url or (
                mod_url
                and re.match(r"^https://mods\.factorio\.com/mod/.*", mod_url)
                is None
            ):
                CTkMessagebox(
                    title="Error",
                    width=500,
                    wraplength=500,
                    message=f"'{mod_url}' is not a valid Factorio mod URL",
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

        if not ignore_overwrite and output.exists() and output.is_dir() and tuple(output.glob("*")):
            response = CTkMessagebox(
                title="Continue?",
                width=500,
                wraplength=450,
                message=f"Directory '{output}' is not empty.\n"
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
            mod_downloader = ModDownloader(mod_urls, download_path, self)
            mod_downloader.start()
        except Exception as e:
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Unknown error occured.\n{str(e).split("\n")[0]}",
            )


def main():
    parser = argparse.ArgumentParser(
        prog="factorio-mod-downloader",
        description="Downloads Factorio mods and their dependencies.",
    )
    parser.add_argument(
        "--headless", 
        action="store_true",
        help="Download mods without launching the GUI."
    )
    parser.add_argument(
        "-s", "--sources", 
        nargs="+",
        help="A space-separated list of mod URLs to download."
    )
    parser.add_argument(
        "-f", "--file", 
        help="The path to a text file containing a newline-separated list of "
             "mod URLs to download."
    )
    parser.add_argument(
        "-d", "--destination",
        help="The destination folder mods should be downloaded to."
    )
    parser.add_argument(
        "-i", "--ignore-overwrite",
        action="store_true",
        default=False,
        help="Automatically continues downloading even if the `destination` is "
             "not a completely empty folder."
    )

    args = parser.parse_args()

    # Collect all urls from modlist file
    if args.file is not None:
        with open(args.file) as file:
            args.sources = [line.strip() for line in file.readlines()]

    if args.headless:
        pass # TODO
    else:
        app = App(sources=args.sources, destination=args.destination)
        app.mainloop()


if __name__ == "__main__":
    main()
