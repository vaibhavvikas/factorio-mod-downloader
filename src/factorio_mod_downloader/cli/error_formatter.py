"""User-friendly error message formatting for CLI.

This module provides utilities to format errors with actionable suggestions
and simplified messages for users while logging detailed errors.
"""

from typing import Optional

from factorio_mod_downloader.infrastructure.errors import (
    ModDownloaderError,
    NetworkError,
    ValidationError,
    FileSystemError,
    ParsingError,
    ErrorCategory,
    get_error_suggestion,
    categorize_error
)


def format_error_message(error: Exception, include_suggestion: bool = True) -> str:
    """Format an error with a user-friendly message.
    
    Args:
        error: Exception to format
        include_suggestion: Whether to include actionable suggestions
        
    Returns:
        Formatted error message
    """
    # Get base error message
    if isinstance(error, ModDownloaderError):
        message = error.message
    else:
        message = str(error)
    
    # Get suggestion if available
    suggestion = None
    if include_suggestion:
        suggestion = get_error_suggestion(error)
    
    # Format the message
    if suggestion:
        return f"{message}\n💡 Suggestion: {suggestion}"
    else:
        return message


def get_common_error_suggestions() -> dict:
    """Get a dictionary of common error patterns and their suggestions.
    
    Returns:
        Dictionary mapping error patterns to suggestions
    """
    return {
        # Network errors
        "connection": "Check your internet connection and try again",
        "timeout": "The server is taking too long to respond. Try again later or increase the timeout.",
        "dns": "Cannot resolve the server address. Check your DNS settings or internet connection.",
        "ssl": "SSL certificate verification failed. Check your system time and date settings.",
        "refused": "Connection refused by server. The server may be down or blocking requests.",
        
        # Filesystem errors
        "permission": "Check file permissions and ensure you have write access to the output directory",
        "disk": "Free up disk space and try again",
        "not found": "The specified path does not exist. Check the path and try again.",
        "exists": "A file or directory with that name already exists",
        
        # Validation errors
        "invalid url": "Check the mod URL format. Expected: https://mods.factorio.com/mod/<mod_name>",
        "invalid format": "The input format is incorrect. Check the documentation for the correct format.",
        "empty": "The input cannot be empty. Please provide a valid value.",
        
        # Parsing errors
        "parse": "Failed to extract information from the page. The page format may have changed.",
        "not found in page": "Could not find expected information on the page. The mod may not exist or the page format changed.",
        "no version": "The mod does not have any published versions available for download."
    }


def suggest_fix_for_error(error: Exception) -> Optional[str]:
    """Suggest a fix for a given error based on common patterns.
    
    Args:
        error: Exception to analyze
        
    Returns:
        Suggestion string if a match is found, None otherwise
    """
    error_str = str(error).lower()
    suggestions = get_common_error_suggestions()
    
    # Check for pattern matches
    for pattern, suggestion in suggestions.items():
        if pattern in error_str:
            return suggestion
    
    # Category-based suggestions
    category = categorize_error(error)
    
    if category == ErrorCategory.NETWORK:
        return "Check your internet connection and try again. If the problem persists, the server may be temporarily unavailable."
    elif category == ErrorCategory.FILESYSTEM:
        return "Check file permissions, available disk space, and ensure the path is valid."
    elif category == ErrorCategory.VALIDATION:
        return "Verify your input is in the correct format and try again."
    elif category == ErrorCategory.PARSING:
        return "The mod page may be temporarily unavailable or the format has changed. Try again later."
    
    return None


def format_error_for_cli(
    error: Exception,
    context: Optional[str] = None,
    show_details: bool = False
) -> str:
    """Format an error message for CLI display.
    
    Args:
        error: Exception to format
        context: Optional context about what was being done when error occurred
        show_details: Whether to show detailed error information
        
    Returns:
        Formatted error message for CLI display
    """
    lines = []
    
    # Add context if provided
    if context:
        lines.append(f"Error: {context}")
    
    # Add main error message
    if isinstance(error, ModDownloaderError):
        lines.append(f"  {error.message}")
    else:
        lines.append(f"  {str(error)}")
    
    # Add suggestion
    suggestion = get_error_suggestion(error)
    if not suggestion:
        suggestion = suggest_fix_for_error(error)
    
    if suggestion:
        lines.append(f"\n💡 Suggestion: {suggestion}")
    
    # Add details if requested
    if show_details:
        lines.append(f"\nError type: {type(error).__name__}")
        if isinstance(error, ModDownloaderError):
            lines.append(f"Category: {error.category.value}")
            lines.append(f"Retryable: {error.retryable}")
    
    return "\n".join(lines)


def format_multiple_errors(
    errors: list,
    max_display: int = 5
) -> str:
    """Format multiple errors for display.
    
    Args:
        errors: List of (context, error) tuples
        max_display: Maximum number of errors to display in detail
        
    Returns:
        Formatted error summary
    """
    if not errors:
        return "No errors to display"
    
    lines = [f"Encountered {len(errors)} error(s):"]
    
    # Display first few errors in detail
    for i, (context, error) in enumerate(errors[:max_display], 1):
        lines.append(f"\n{i}. {context}")
        lines.append(f"   {str(error)}")
        
        suggestion = get_error_suggestion(error)
        if suggestion:
            lines.append(f"   💡 {suggestion}")
    
    # If there are more errors, show count
    if len(errors) > max_display:
        remaining = len(errors) - max_display
        lines.append(f"\n... and {remaining} more error(s)")
    
    return "\n".join(lines)


def get_retry_message(attempt: int, max_attempts: int, error: Exception) -> str:
    """Get a message for retry attempts.
    
    Args:
        attempt: Current attempt number
        max_attempts: Maximum number of attempts
        error: Error that occurred
        
    Returns:
        Formatted retry message
    """
    remaining = max_attempts - attempt
    
    if remaining > 0:
        return f"Retrying... ({remaining} attempt(s) remaining)"
    else:
        suggestion = get_error_suggestion(error)
        if suggestion:
            return f"Max retries exceeded. {suggestion}"
        else:
            return "Max retries exceeded. Please try again later."
