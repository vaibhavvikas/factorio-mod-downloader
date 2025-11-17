"""GUI module - ensures tkinter is imported for PyInstaller."""

# Import tkinter at module level so PyInstaller can detect it
try:
    import tkinter
    import tkinter.ttk
    import tkinter.messagebox
    import tkinter.filedialog
    import _tkinter
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False

__all__ = ['TKINTER_AVAILABLE']