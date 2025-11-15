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


def hide_console():
    """Hide the console window on Windows when in GUI mode.""" 
    try:
        import platform
        if platform.system() != 'Windows':
            return
        
        import ctypes
        import ctypes.wintypes
        
        # Get console window handle
        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        user32 = ctypes.WinDLL('user32', use_last_error=True)
        
        hwnd = kernel32.GetConsoleWindow()
        if hwnd:
            # SW_HIDE = 0
            user32.ShowWindow(hwnd, 0)
    except Exception as e:
        # If hiding fails, just continue
        # Print to stderr in case console is still visible
        print(f"Note: Could not hide console: {e}", file=sys.stderr)
        pass


def main():
    """Initialize and launch the application (CLI or GUI)."""
    args = sys.argv[1:]

    if should_use_cli(args):
        # CLI mode - import CLI dependencies only when needed
        from factorio_mod_downloader.cli.app import cli_main
        sys.exit(cli_main(args))
    else:
        # GUI mode - hide console window and import GUI dependencies
        hide_console()
        from factorio_mod_downloader.gui.app import App
        app = App()
        app.mainloop()


if __name__ == "__main__":
    main()