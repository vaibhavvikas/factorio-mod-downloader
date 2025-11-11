"""Input validation for CLI arguments."""

import re
from pathlib import Path
from typing import Tuple

from factorio_mod_downloader.infrastructure.errors import ValidationError


def validate_mod_url(url: str) -> Tuple[bool, str]:
    """Validate that a URL matches the expected Factorio mod portal pattern.
    
    Args:
        url: URL to validate.
        
    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if not url:
        return False, "URL cannot be empty"
    
    # Expected pattern: https://mods.factorio.com/mod/<mod_name>
    # Also accept: https://mods.factorio.com/mod/<mod_name>/downloads/<version>
    pattern = r'^https?://mods\.factorio\.com/mod/[a-zA-Z0-9_-]+(/downloads/\d+)?$'
    
    if not re.match(pattern, url):
        return False, (
            f"Invalid mod URL format: {url}\n"
            "Expected format: https://mods.factorio.com/mod/<mod_name>\n"
            "Example: https://mods.factorio.com/mod/Krastorio2"
        )
    
    return True, ""


def validate_file_path(file_path: str, must_exist: bool = True, 
                      must_be_file: bool = False, 
                      must_be_dir: bool = False) -> Tuple[bool, str]:
    """Validate that a file path exists and is accessible.
    
    Args:
        file_path: Path to validate.
        must_exist: If True, path must exist.
        must_be_file: If True, path must be a file.
        must_be_dir: If True, path must be a directory.
        
    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if not file_path:
        return False, "Path cannot be empty"
    
    path = Path(file_path)
    
    # Check existence
    if must_exist and not path.exists():
        return False, f"Path does not exist: {file_path}"
    
    # Check if it's a file
    if must_be_file and path.exists() and not path.is_file():
        return False, f"Path is not a file: {file_path}"
    
    # Check if it's a directory
    if must_be_dir and path.exists() and not path.is_dir():
        return False, f"Path is not a directory: {file_path}"
    
    # Check if path is accessible (readable)
    if path.exists():
        try:
            # Try to access the path
            if path.is_file():
                # Try to open file for reading
                with open(path, 'r') as f:
                    pass
            elif path.is_dir():
                # Try to list directory
                list(path.iterdir())
        except PermissionError:
            return False, f"Permission denied: {file_path}"
        except Exception as e:
            return False, f"Cannot access path: {file_path} ({e})"
    
    return True, ""


def validate_directory_path(dir_path: str, must_exist: bool = True, 
                           create_if_missing: bool = False) -> Tuple[bool, str]:
    """Validate a directory path.
    
    Args:
        dir_path: Directory path to validate.
        must_exist: If True, directory must exist.
        create_if_missing: If True, create directory if it doesn't exist.
        
    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if not dir_path:
        return False, "Directory path cannot be empty"
    
    path = Path(dir_path)
    
    # If directory doesn't exist
    if not path.exists():
        if create_if_missing:
            try:
                path.mkdir(parents=True, exist_ok=True)
                return True, ""
            except Exception as e:
                return False, f"Cannot create directory: {dir_path} ({e})"
        elif must_exist:
            return False, f"Directory does not exist: {dir_path}"
        else:
            return True, ""
    
    # Check if it's actually a directory
    if not path.is_dir():
        return False, f"Path is not a directory: {dir_path}"
    
    # Check if directory is accessible
    try:
        list(path.iterdir())
    except PermissionError:
        return False, f"Permission denied: {dir_path}"
    except Exception as e:
        return False, f"Cannot access directory: {dir_path} ({e})"
    
    return True, ""


def validate_batch_file(file_path: str) -> Tuple[bool, str]:
    """Validate a batch file containing mod URLs (JSON format).
    
    Args:
        file_path: Path to batch file (must be .json).
        
    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    # First validate that it's a readable file
    is_valid, error = validate_file_path(file_path, must_exist=True, must_be_file=True)
    if not is_valid:
        return False, error
    
    # Check file extension
    path = Path(file_path)
    if path.suffix.lower() != '.json':
        return False, (
            f"Batch file must be a JSON file (.json extension): {file_path}\n"
            "Example: mods.json"
        )
    
    # Try to read and validate JSON content
    try:
        import json
        with open(file_path, 'r', encoding='utf-8') as f:
            batch_data = json.load(f)
        
        # Extract URLs based on format
        urls = []
        if isinstance(batch_data, dict):
            if 'mods' not in batch_data:
                return False, (
                    "JSON batch file must contain a 'mods' array.\n"
                    "Example format:\n"
                    '{\n'
                    '  "mods": [\n'
                    '    "https://mods.factorio.com/mod/Krastorio2",\n'
                    '    "https://mods.factorio.com/mod/space-exploration"\n'
                    '  ]\n'
                    '}'
                )
            mods_list = batch_data['mods']
            if not isinstance(mods_list, list):
                return False, "'mods' must be an array"
            
            for item in mods_list:
                if isinstance(item, str):
                    urls.append(item)
                elif isinstance(item, dict) and 'url' in item:
                    urls.append(item['url'])
                    
        elif isinstance(batch_data, list):
            for item in batch_data:
                if isinstance(item, str):
                    urls.append(item)
                elif isinstance(item, dict) and 'url' in item:
                    urls.append(item['url'])
        else:
            return False, "JSON must be an object with 'mods' array or a direct array"
        
        # Check if any URLs found
        if not urls:
            return False, f"Batch file contains no valid mod URLs: {file_path}"
        
        # Validate each URL
        invalid_urls = []
        for i, url in enumerate(urls, 1):
            is_valid_url, _ = validate_mod_url(url)
            if not is_valid_url:
                invalid_urls.append((i, url))
        
        if invalid_urls:
            error_lines = "\n".join(
                f"  Item {idx}: {url}" 
                for idx, url in invalid_urls[:5]  # Show first 5 errors
            )
            if len(invalid_urls) > 5:
                error_lines += f"\n  ... and {len(invalid_urls) - 5} more"
            
            return False, (
                f"Batch file contains invalid URLs:\n{error_lines}\n"
                "Expected format: https://mods.factorio.com/mod/<mod_name>"
            )
        
        return True, ""
        
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON format: {e}"
    except UnicodeDecodeError:
        return False, f"Cannot read batch file (encoding error): {file_path}"
    except Exception as e:
        return False, f"Error reading batch file: {file_path} ({e})"


def validate_positive_integer(value: int, name: str, min_value: int = 1) -> Tuple[bool, str]:
    """Validate that a value is a positive integer.
    
    Args:
        value: Value to validate.
        name: Name of the parameter (for error messages).
        min_value: Minimum allowed value.
        
    Returns:
        Tuple of (is_valid, error_message). error_message is empty if valid.
    """
    if not isinstance(value, int):
        return False, f"{name} must be an integer, got {type(value).__name__}"
    
    if value < min_value:
        return False, f"{name} must be at least {min_value}, got {value}"
    
    return True, ""


def validate_and_raise(is_valid: bool, error_message: str):
    """Helper to raise ValidationError if validation failed.
    
    Args:
        is_valid: Whether validation passed.
        error_message: Error message if validation failed.
        
    Raises:
        ValidationError: If validation failed.
    """
    if not is_valid:
        raise ValidationError(error_message)
