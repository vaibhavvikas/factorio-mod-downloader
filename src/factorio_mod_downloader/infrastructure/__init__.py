"""Infrastructure module for Factorio Mod Downloader."""

from factorio_mod_downloader.infrastructure.config import Config, ConfigManager
from factorio_mod_downloader.infrastructure.errors import (
    ErrorCategory,
    ModDownloaderError,
    NetworkError,
    ValidationError,
    FileSystemError,
    ParsingError,
    is_retryable_error,
    get_error_suggestion,
    categorize_error
)
from factorio_mod_downloader.infrastructure.registry import ModEntry, ModRegistry
from factorio_mod_downloader.infrastructure.recovery import RecoveryManager

__all__ = [
    'Config',
    'ConfigManager',
    'ErrorCategory',
    'ModDownloaderError',
    'NetworkError',
    'ValidationError',
    'FileSystemError',
    'ParsingError',
    'is_retryable_error',
    'get_error_suggestion',
    'categorize_error',
    'ModEntry',
    'ModRegistry',
    'RecoveryManager'
]
