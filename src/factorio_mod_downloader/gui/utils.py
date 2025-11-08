"""
Utility functions for the application.
"""

import os
import sys
from pathlib import Path


def resource_path(relative_path: str) -> str:
    """
    Get the absolute path to a resource file.

    Works with both development and PyInstaller-bundled environments.

    Args:
        relative_path: Relative path to the resource file

    Returns:
        Absolute path to the resource file
    """
    PROJECT_ROOT = Path(__file__).resolve().parent.parent
    ASSETS_DIR = PROJECT_ROOT / "assets"
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, ASSETS_DIR, relative_path)
    return os.path.join(ASSETS_DIR, relative_path)


def ensure_directory_exists(path: str) -> Path:
    """
    Ensure a directory exists and create it if needed.

    Args:
        path: Directory path

    Returns:
        Path object of the directory
    """
    output = Path(path).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    return output
