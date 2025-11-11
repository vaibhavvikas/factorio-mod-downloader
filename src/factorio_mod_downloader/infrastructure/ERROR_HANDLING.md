# Error Handling Documentation

## Overview

This document describes the comprehensive error handling system implemented for the Factorio Mod Downloader CLI.

## Error Categories

The system defines four main error categories:

### 1. Network Errors (`NetworkError`)
- **Retryable**: Yes
- **Examples**: Connection failures, timeouts, DNS errors
- **Handling**: Automatic retry with exponential backoff (configurable max_retries)
- **Default Suggestion**: "Check your internet connection and try again"

### 2. Validation Errors (`ValidationError`)
- **Retryable**: No (fail-fast)
- **Examples**: Invalid URLs, malformed input, empty values
- **Handling**: Immediate failure with clear error message
- **Suggestions**: Format-specific guidance based on the validation failure

### 3. Filesystem Errors (`FileSystemError`)
- **Retryable**: No (fail-fast)
- **Examples**: Permission denied, disk full, path not found
- **Handling**: Immediate failure with actionable message
- **Default Suggestion**: "Check file permissions and available disk space"

### 4. Parsing Errors (`ParsingError`)
- **Retryable**: Yes (limited retries)
- **Examples**: Cannot extract mod info from HTML, page format changed
- **Handling**: Retry once after delay
- **Default Suggestion**: "The mod page might be temporarily unavailable. Try again later."

## Error Classes

### Base Class: `ModDownloaderError`

All custom errors inherit from this base class which provides:
- `message`: Human-readable error message
- `category`: Error category (enum)
- `retryable`: Boolean indicating if error can be retried
- `suggestion`: Optional actionable suggestion for fixing the error

### Specific Error Classes

```python
# Network error (retryable)
raise NetworkError(
    "Connection timeout",
    suggestion="The server is taking too long to respond"
)

# Validation error (not retryable)
raise ValidationError(
    "Invalid mod URL format",
    suggestion="Expected format: https://mods.factorio.com/mod/<mod_name>"
)

# Filesystem error (not retryable)
raise FileSystemError(
    "Cannot create output directory",
    suggestion="Check directory permissions and available disk space"
)

# Parsing error (retryable)
raise ParsingError(
    "Could not find mod name in page",
    suggestion="The mod page format may have changed"
)
```

## Utility Functions

### `is_retryable_error(error: Exception) -> bool`
Determines if an error should be retried. Works with both custom `ModDownloaderError` instances and standard Python exceptions.

### `get_error_suggestion(error: Exception) -> Optional[str]`
Returns an actionable suggestion for fixing the error, if available.

### `categorize_error(error: Exception) -> ErrorCategory`
Categorizes any exception into one of the four error categories.

## User-Friendly Error Formatting

The `cli/error_formatter.py` module provides utilities for formatting errors with user-friendly messages:

### `format_error_for_cli(error, context, show_details)`
Formats an error for CLI display with:
- Context about what was being done
- Clear error message
- Actionable suggestion (💡 icon)
- Optional detailed information

### `format_multiple_errors(errors, max_display)`
Formats multiple errors in a summary format, showing the first few in detail and counting the rest.

### `suggest_fix_for_error(error)`
Analyzes error messages for common patterns and provides specific suggestions.

## Integration Points

### File Downloader (`core/file_downloader.py`)
- Catches filesystem errors and fails fast
- Retries network errors with configurable max_retries
- Uses `is_retryable_error()` to determine retry logic

### Mod Info Fetcher (`core/mod_info_fetcher.py`)
- Raises `NetworkError` for page loading failures
- Raises `ParsingError` when mod information cannot be extracted

### CLI Application (`cli/app.py`)
- Uses `format_error_for_cli()` for all error messages
- Provides context-specific error messages
- Logs detailed errors while showing simplified messages to users

### Validators (`cli/validators.py`)
- Uses `ValidationError` from infrastructure module
- Provides specific validation error messages with suggestions

## Error Handling Flow

```
┌─────────────────┐
│  Error Occurs   │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Categorize Error    │
│ (Network/Validation/│
│  FileSystem/Parsing)│
└────────┬────────────┘
         │
         ▼
    ┌────────┐
    │Retryable?│
    └───┬────┘
        │
   ┌────┴────┐
   │         │
  Yes       No
   │         │
   ▼         ▼
┌──────┐  ┌──────────┐
│Retry │  │Fail Fast │
│Logic │  │          │
└──┬───┘  └────┬─────┘
   │           │
   │           ▼
   │      ┌─────────────┐
   │      │Format Error │
   │      │with Context │
   │      │& Suggestion │
   │      └─────────────┘
   │
   └──────────┐
              │
              ▼
      ┌──────────────┐
      │Max Retries?  │
      └───┬──────────┘
          │
     ┌────┴────┐
     │         │
    Yes       No
     │         │
     ▼         ▼
┌─────────┐  ┌──────┐
│Fail with│  │Retry │
│Suggestion│  │      │
└─────────┘  └──────┘
```

## Examples

### Example 1: Network Error with Retry
```python
try:
    response = requests.get(url, timeout=30)
except requests.exceptions.ConnectionError as e:
    # Automatically categorized as NetworkError
    # Will be retried up to max_retries times
    # User sees: "Connection failed. Check your internet connection and try again"
```

### Example 2: Validation Error (Fail Fast)
```python
if not re.match(pattern, url):
    raise ValidationError(
        f"Invalid mod URL format: {url}",
        suggestion="Expected format: https://mods.factorio.com/mod/<mod_name>"
    )
    # No retry, immediate failure
    # User sees formatted error with suggestion
```

### Example 3: Filesystem Error (Fail Fast)
```python
try:
    os.makedirs(output_path)
except PermissionError as e:
    raise FileSystemError(
        f"Cannot create directory: {e}",
        suggestion="Check directory permissions and ensure you have write access"
    )
    # No retry, immediate failure
```

## Configuration

Error handling behavior can be configured via `config.yaml`:

```yaml
max_retries: 3          # Maximum retry attempts for retryable errors
retry_delay: 2          # Delay in seconds between retries
log_level: INFO         # Logging level (DEBUG for detailed error info)
```

## Best Practices

1. **Always provide context**: Use `format_error_for_cli()` with a context parameter
2. **Include suggestions**: Provide actionable suggestions when raising custom errors
3. **Log detailed errors**: Use logger for detailed error information while showing simplified messages to users
4. **Fail fast for non-retryable errors**: Don't retry validation or filesystem errors
5. **Use appropriate error types**: Choose the correct error class based on the failure type
6. **Test error paths**: Ensure error messages are helpful and suggestions are accurate
