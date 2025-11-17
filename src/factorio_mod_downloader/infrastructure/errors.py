"""Error categories and handling for Factorio Mod Downloader.

This module defines error types and provides utilities for error handling,
including retry logic for retryable errors and fail-fast for non-retryable errors.
"""

from enum import Enum
from typing import Optional


class ErrorCategory(Enum):
    """Categories of errors that can occur during mod downloading."""
    NETWORK = "network"
    VALIDATION = "validation"
    FILESYSTEM = "filesystem"
    PARSING = "parsing"


class ModDownloaderError(Exception):
    """Base exception for all mod downloader errors.
    
    Attributes:
        message: Human-readable error message
        category: Error category for handling logic
        retryable: Whether this error can be retried
        suggestion: Optional suggestion for fixing the error
    """
    
    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        retryable: bool = False,
        suggestion: Optional[str] = None
    ):
        """Initialize ModDownloaderError.
        
        Args:
            message: Human-readable error message
            category: Error category
            retryable: Whether this error can be retried
            suggestion: Optional suggestion for fixing the error
        """
        super().__init__(message)
        self.message = message
        self.category = category
        self.retryable = retryable
        self.suggestion = suggestion
    
    def __str__(self):
        """Return string representation of error."""
        return self.message


class NetworkError(ModDownloaderError):
    """Network-related errors (connection failures, timeouts).
    
    These errors are typically retryable with exponential backoff.
    """
    
    def __init__(self, message: str, suggestion: Optional[str] = None):
        """Initialize NetworkError.
        
        Args:
            message: Human-readable error message
            suggestion: Optional suggestion for fixing the error
        """
        super().__init__(
            message=message,
            category=ErrorCategory.NETWORK,
            retryable=True,
            suggestion=suggestion or "Check your internet connection and try again"
        )


class ValidationError(ModDownloaderError):
    """Validation errors (invalid URLs, malformed input).
    
    These errors are not retryable and should fail fast.
    """
    
    def __init__(self, message: str, suggestion: Optional[str] = None):
        """Initialize ValidationError.
        
        Args:
            message: Human-readable error message
            suggestion: Optional suggestion for fixing the error
        """
        super().__init__(
            message=message,
            category=ErrorCategory.VALIDATION,
            retryable=False,
            suggestion=suggestion
        )


class FileSystemError(ModDownloaderError):
    """File system errors (permission denied, disk full).
    
    These errors are not retryable and should fail fast.
    """
    
    def __init__(self, message: str, suggestion: Optional[str] = None):
        """Initialize FileSystemError.
        
        Args:
            message: Human-readable error message
            suggestion: Optional suggestion for fixing the error
        """
        super().__init__(
            message=message,
            category=ErrorCategory.FILESYSTEM,
            retryable=False,
            suggestion=suggestion
        )


class ParsingError(ModDownloaderError):
    """Parsing errors (cannot extract mod info from HTML).
    
    These errors are retryable once after a delay, as the page might be temporarily unavailable.
    """
    
    def __init__(self, message: str, suggestion: Optional[str] = None):
        """Initialize ParsingError.
        
        Args:
            message: Human-readable error message
            suggestion: Optional suggestion for fixing the error
        """
        super().__init__(
            message=message,
            category=ErrorCategory.PARSING,
            retryable=True,
            suggestion=suggestion or "The mod page might be temporarily unavailable. Try again later."
        )


def is_retryable_error(error: Exception) -> bool:
    """Check if an error is retryable.
    
    Args:
        error: Exception to check
        
    Returns:
        True if the error is retryable, False otherwise
    """
    if isinstance(error, ModDownloaderError):
        return error.retryable
    
    # Check for common retryable exceptions
    import requests
    if isinstance(error, (
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.ChunkedEncodingError,
        TimeoutError,
        ConnectionError
    )):
        return True
    
    return False


def get_error_suggestion(error: Exception) -> Optional[str]:
    """Get a suggestion for fixing an error.
    
    Args:
        error: Exception to get suggestion for
        
    Returns:
        Suggestion string if available, None otherwise
    """
    if isinstance(error, ModDownloaderError):
        return error.suggestion
    
    # Provide suggestions for common exceptions
    import requests
    if isinstance(error, requests.exceptions.ConnectionError):
        return "Check your internet connection and try again"
    elif isinstance(error, requests.exceptions.Timeout):
        return "The server is taking too long to respond. Try again later."
    elif isinstance(error, PermissionError):
        return "Check file permissions and ensure you have write access to the output directory"
    elif isinstance(error, OSError) and "No space left on device" in str(error):
        return "Free up disk space and try again"
    
    return None


def categorize_error(error: Exception) -> ErrorCategory:
    """Categorize an exception into an error category.
    
    Args:
        error: Exception to categorize
        
    Returns:
        ErrorCategory for the exception
    """
    if isinstance(error, ModDownloaderError):
        return error.category
    
    # Categorize common exceptions
    import requests
    if isinstance(error, (
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.ChunkedEncodingError,
        TimeoutError,
        ConnectionError
    )):
        return ErrorCategory.NETWORK
    elif isinstance(error, (PermissionError, OSError, IOError)):
        return ErrorCategory.FILESYSTEM
    elif isinstance(error, (ValueError, TypeError)):
        return ErrorCategory.VALIDATION
    
    # Default to parsing for unknown errors
    return ErrorCategory.PARSING
