"""
Factorio Mod Downloader - Entry Point
"""

from factorio_mod_downloader.gui.app import App


def main():
    """Initialize and launch the application."""
    app = App()
    app.mainloop()


if __name__ == "__main__":
    main()
