"""Download recovery and resumption management for Factorio Mod Downloader."""

import os
from pathlib import Path
from typing import Optional
import requests


class RecoveryManager:
    """Manages download recovery and resumption.
    
    Handles:
    - Partial file detection (.part files)
    - Resume position calculation
    - Partial file validation
    - Server support detection for range requests
    - Cleanup of completed downloads
    """
    
    PART_EXTENSION = '.part'
    
    def __init__(self, logger, config):
        """Initialize RecoveryManager.
        
        Args:
            logger: LoggerSystem instance for logging
            config: Config object with retry settings
        """
        self.logger = logger
        self.config = config
    
    def _get_partial_path(self, file_path: str) -> str:
        """Get the .part file path for a given file path.
        
        Args:
            file_path: Target file path
            
        Returns:
            Path to the .part file
        """
        return f"{file_path}{self.PART_EXTENSION}"
    
    def _partial_file_exists(self, file_path: str) -> bool:
        """Check if a partial file exists.
        
        Args:
            file_path: Target file path
            
        Returns:
            True if .part file exists, False otherwise
        """
        partial_path = self._get_partial_path(file_path)
        return os.path.exists(partial_path)
    
    def get_resume_position(self, file_path: str) -> int:
        """Get byte position to resume from.
        
        Args:
            file_path: Target file path
            
        Returns:
            Byte position to resume from (0 if no partial file or invalid)
        """
        partial_path = self._get_partial_path(file_path)
        
        if not os.path.exists(partial_path):
            self.logger.debug(f"No partial file found at {partial_path}")
            return 0
        
        try:
            file_size = os.path.getsize(partial_path)
            if file_size > 0:
                self.logger.info(
                    f"Found partial download",
                    file=partial_path,
                    size_bytes=file_size
                )
                return file_size
            else:
                self.logger.warning(f"Partial file is empty: {partial_path}")
                return 0
        except OSError as e:
            self.logger.error(f"Error reading partial file size: {e}")
            return 0
    
    def validate_partial(self, file_path: str) -> bool:
        """Validate partial file integrity.
        
        Checks if the partial file exists and has a valid size.
        
        Args:
            file_path: Target file path
            
        Returns:
            True if partial file is valid, False otherwise
        """
        partial_path = self._get_partial_path(file_path)
        
        if not os.path.exists(partial_path):
            self.logger.debug(f"Partial file does not exist: {partial_path}")
            return False
        
        try:
            file_size = os.path.getsize(partial_path)
            
            # Check if file has content
            if file_size <= 0:
                self.logger.warning(f"Partial file is empty or invalid: {partial_path}")
                return False
            
            # Check if file is readable
            with open(partial_path, 'rb') as f:
                # Try to read first byte to ensure file is accessible
                f.read(1)
            
            self.logger.debug(
                f"Partial file validation passed",
                file=partial_path,
                size_bytes=file_size
            )
            return True
            
        except (OSError, IOError) as e:
            self.logger.error(
                f"Partial file validation failed",
                file=partial_path,
                error=str(e)
            )
            return False

    def can_resume(self, file_path: str, url: str) -> bool:
        """Check if a download can be resumed.
        
        Checks both if a valid partial file exists and if the server
        supports range requests (HTTP Range header).
        
        Args:
            file_path: Target file path
            url: Download URL to check for range support
            
        Returns:
            True if download can be resumed, False otherwise
        """
        # First check if we have a valid partial file
        if not self.validate_partial(file_path):
            self.logger.debug(f"Cannot resume: no valid partial file for {file_path}")
            return False
        
        # Check if server supports range requests
        try:
            self.logger.debug(f"Checking server range support for {url}")
            response = requests.head(url, timeout=10, allow_redirects=True)
            
            # Check for Accept-Ranges header
            accept_ranges = response.headers.get('Accept-Ranges', '').lower()
            
            if accept_ranges == 'bytes':
                self.logger.info(f"Server supports range requests for {url}")
                return True
            elif accept_ranges == 'none':
                self.logger.warning(
                    f"Server explicitly does not support range requests",
                    url=url
                )
                return False
            else:
                # Some servers don't send Accept-Ranges but still support it
                # Try a range request to verify
                self.logger.debug(f"Accept-Ranges header not found, testing range request")
                test_response = requests.head(
                    url,
                    headers={'Range': 'bytes=0-0'},
                    timeout=10,
                    allow_redirects=True
                )
                
                if test_response.status_code == 206:  # Partial Content
                    self.logger.info(f"Server supports range requests (verified by test)")
                    return True
                else:
                    self.logger.warning(
                        f"Server does not support range requests",
                        url=url,
                        status_code=test_response.status_code
                    )
                    return False
                    
        except requests.RequestException as e:
            self.logger.error(
                f"Error checking server range support",
                url=url,
                error=str(e)
            )
            return False
    
    def create_partial_file(self, file_path: str) -> str:
        """Create .part file for partial download.
        
        Args:
            file_path: Target file path
            
        Returns:
            Path to the created .part file
        """
        partial_path = self._get_partial_path(file_path)
        
        # Ensure parent directory exists
        parent_dir = os.path.dirname(partial_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        
        # Create empty .part file if it doesn't exist
        if not os.path.exists(partial_path):
            with open(partial_path, 'wb') as f:
                pass  # Create empty file
            self.logger.debug(f"Created partial file: {partial_path}")
        else:
            self.logger.debug(f"Partial file already exists: {partial_path}")
        
        return partial_path
    
    def finalize_download(self, partial_path: str, final_path: str):
        """Move partial file to final location.
        
        Renames the .part file to the final filename after successful download.
        
        Args:
            partial_path: Path to the .part file
            final_path: Final destination path
            
        Raises:
            OSError: If file move operation fails
        """
        try:
            # Ensure parent directory exists for final path
            parent_dir = os.path.dirname(final_path)
            if parent_dir:
                os.makedirs(parent_dir, exist_ok=True)
            
            # Remove final file if it already exists
            if os.path.exists(final_path):
                self.logger.warning(f"Overwriting existing file: {final_path}")
                os.remove(final_path)
            
            # Move partial file to final location
            os.rename(partial_path, final_path)
            
            self.logger.info(
                f"Download finalized",
                partial_file=partial_path,
                final_file=final_path
            )
            
        except OSError as e:
            self.logger.error(
                f"Error finalizing download",
                partial_file=partial_path,
                final_file=final_path,
                error=str(e)
            )
            raise
    
    def cleanup_partial(self, file_path: str):
        """Clean up partial download files.
        
        Removes the .part file after successful download completion.
        
        Args:
            file_path: Target file path (not the .part file)
        """
        partial_path = self._get_partial_path(file_path)
        
        if os.path.exists(partial_path):
            try:
                os.remove(partial_path)
                self.logger.debug(f"Cleaned up partial file: {partial_path}")
            except OSError as e:
                self.logger.warning(
                    f"Could not clean up partial file",
                    file=partial_path,
                    error=str(e)
                )
        else:
            self.logger.debug(f"No partial file to clean up: {partial_path}")
