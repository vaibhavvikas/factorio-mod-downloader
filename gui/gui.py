from pathlib import Path
import tkinter as tk
import tkinter.messagebox as tk1
import tkinter.filedialog
import os
import sys
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from mod_downloader import ModDownloader
except ModuleNotFoundError:
    raise RuntimeError("Couldn't add ModDownloader to the PATH.")

OUTPUT_PATH = Path(__file__).parent
ASSETS_PATH = Path(__file__).resolve().parent / "assets"


def relative_to_assets(path: str) -> Path:
    return ASSETS_PATH / Path(path)

def make_label(master, x, y, h, w, *args, **kwargs):
    f = tk.Frame(master, height=h, width=w)
    f.pack_propagate(0)  # don't shrink
    f.place(x=x, y=y)

    label = tk.Label(f, *args, **kwargs)
    label.pack(fill=tk.BOTH, expand=1)

    return label

def select_path():
    global output_path

    output_path = tk.filedialog.askdirectory()
    path_entry.delete(0, tk.END)
    path_entry.insert(0, output_path)


def btn_clicked():
    url = url_entry.get()
    output_path = path_entry.get()
    output_path = output_path.strip()

    if not url:
        tk.messagebox.showerror(
            title="Empty Fields!", message="Please enter URL.")
        return
    
    if not output_path:
        tk.messagebox.showerror(
            title="Invalid Path!", message="Enter a valid output path.")
        return

    match = re.match(r'^https://mods\.factorio\.com/mod/.*', url.strip())
    if match is None:
        tk.messagebox.showerror(
            "Invalid URL!", "Please enter a valid file URL.")
        return

    output_path = f"{output_path}/mods"
    output = Path(output_path).expanduser().resolve()

    if output.exists() and not output.is_dir():
        tk1.showerror(
            "Exists!",
            f"{output} already exists and is not a directory.\n"
            "Enter a valid output directory.")
    elif output.exists() and output.is_dir() and tuple(output.glob('*')):
        response = tk1.askyesno(
            "Continue?",
            f"Directory {output} is not empty.\n"
            "Do you want to continue and overwrite?")
        if not response:
            return

    # Function to add code
    mod_downloader = ModDownloader(url, output_path)
    mod_downloader.start_download()

    tk.messagebox.showinfo(
        "Success!", f"Mods successfully downloaded at {output}.")


# Required in order to add data files to Windows executable
path = getattr(sys, '_MEIPASS', os.getcwd())
os.chdir(path)

output_path = ""

window = tk.Tk()
window.geometry("862x519")
window.configure(bg = "#3A7FF6")
window.title("Factorio Mod Downloader")


canvas = tk.Canvas(
    window,
    bg = "#3A7FF6",
    height = 519,
    width = 862,
    bd = 0,
    highlightthickness = 0,
    relief = "ridge"
)

canvas.place(x = 0, y = 0)
canvas.create_rectangle(
    430.9999999999999,
    0.0,
    861.9999999999999,
    519.0,
    fill="#FCFCFC",
    outline="")

canvas.create_text(
    482.0,
    60.0,
    anchor="nw",
    text="Enter the details.",
    fill="#505485",
    font=("Roboto Bold", 24 * -1)
)

canvas.create_text(
    490.0, 139.0, text="Factorio Mod Url",
    fill="#515486", font=("Arial-BoldMT", int(13.0)), anchor="w")

url_entry_image = tk.PhotoImage(
    file=relative_to_assets("entry.png"))
url_entry_bg = canvas.create_image(
    650.5,
    184.5,
    image=url_entry_image
)
url_entry = tk.Entry(
    bd=0,
    bg="#F1F5FF",
    fg="#000716",
    highlightthickness=0
)
url_entry.place(
    x=490,
    y=154.0,
    width=321.0,
    height=59.0
)


canvas.create_text(
    490.0, 251.0, text="Output Path",
    fill="#515486", font=("Arial-BoldMT", int(13.0)), anchor="w")

path_entry_image = tk.PhotoImage(
    file=relative_to_assets("entry.png"))
path_entry_bg = canvas.create_image(
    650.5,
    296.5,
    image=path_entry_image
)
path_entry = tk.Entry(
    bd=0,
    bg="#F1F5FF",
    fg="#000716",
    highlightthickness=0
)
path_entry.place(
    x=490.0,
    y=266.0,
    width=321.0,
    height=59.0
)

path_picker_img = tk.PhotoImage(
    file=relative_to_assets("path_picker_button.png"))

path_picker_button = tk.Button(
    image = path_picker_img,
    text = '',
    compound = 'center',
    fg = 'white',
    borderwidth = 0,
    highlightthickness = 0,
    command = select_path,
    relief = 'flat')


path_picker_button.place(
    x=783.0,
    y=286.0,
    width=24.0,
    height=22.0
)

generate_image = tk.PhotoImage(
    file=relative_to_assets("button_1.png"))
generate_button = tk.Button(
    image=generate_image,
    borderwidth=0,
    highlightthickness=0,
    command=btn_clicked,
    relief="flat"
)
generate_button.place(
    x=557.0,
    y=360.0,
    width=180.0,
    height=55.0
)


canvas.create_text(
    70.0,
    214.0,
    anchor="nw",
    text="Factorio Mods\nDownloader",
    fill="#FFFFFF",
    font=("Roboto Bold", 34 * -1)
)

window.resizable(False, False)
window.mainloop()
