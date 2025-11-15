"""
Factorio Mod Downloader - Entry Point

Routes to CLI or GUI based on command-line arguments.
"""

import sys
from typing import List


def should_use_cli(args: List[str]) -> bool:
    """Determine if CLI mode should be used based on arguments.
    
    Args:
        args: Command-line arguments (excluding program name). 
        
    Returns:
        True if CLI mode should be used, False for GUI mode.   
    """
    # No arguments means GUI mode
    if not args:
        return False
    
    # Explicit GUI flag
    if '--gui' in args:
        return False
    
    # Any other arguments mean CLI mode
    return True


def main():
    """Initialize and launch the application (CLI or GUI)."""
    args = sys.argv[1:]

    if should_use_cli(args):
        # CLI mode - import CLI dependencies only when needed
        from factorio_mod_downloader.cli.app import cli_main
        sys.exit(cli_main(args))
    else:
        # GUI mode - import GUI dependencies
        # Hide console only after GUI import succeeds
        try:
            from factorio_mod_downloader.gui.app import App
            
            # Try to hide console on Windows (non-critical)
            try:
                import platform
                if platform.system() == 'Windows':
                    from ctypes import windll
                    hwnd = windll.kernel32.GetConsoleWindow()
                    if hwnd != 0:
                        windll.user32.ShowWindow(hwnd, 0)
            except:
                pass  # Silently ignore if hiding fails
            
            app = App()
            app.mainloop()
        except ImportError as e:
            print(f"Error: Failed to load GUI components: {e}")
            print("\nPossible causes:")
            print("  - tkinter is not installed with Python")
            print("  - customtkinter is not installed")
            print("\nTry running in CLI mode instead:")
            print("  fmd --help")
            sys.exit(1)


if __name__ == "__main__":
    main()