"""File download with progress tracking and retry logic."""

import os
import time
from dataclasses import dataclass
from typing import Callable, Optional

import requests

from factorio_mod_downloader.infrastructure.recovery import RecoveryManager
from factorio_mod_downloader.infrastructure.errors import (
    NetworkError,
    FileSystemError,
    is_retryable_error,
    categorize_error,
    ErrorCategory
)


@dataclass
class DownloadFileResult:
    """Result of a single file download."""
    success: bool
    file_path: str
    size: int
    duration: float
    error: Optional[str] = None


class FileDownloader:
    """Handles file downloads with progress and retry.
    
    This class extracts the file download logic from ModDownloader
    and makes it independent of GUI callbacks. It supports:
    - Progress callbacks for UI updates
    - Retry logic with configurable max_retries
    - Resume support via RecoveryManager
    - Generic progress callbacks (not GUI-specific)
    """
    
    def __init__(self, logger, config):
        """Initialize FileDownloader.
        
        Args:
            logger: LoggerSystem instance for logging
            config: Config object with retry settings
        """
        self.logger = logger
        self.config = config
        self.recovery_manager = RecoveryManager(logger, config)
    
    def download_file(
        self,
        url: str,
        output_path: str,
        progress_callback: Optional[Callable] = None,
        resume: bool = True
    ) -> DownloadFileResult:
        """Download a file with progress tracking and retry.
        
        Args:
            url: File URL to download
            output_path: Local path to save file
            progress_callback: Optional callback for progress updates.
                             Called with (percentage, downloaded_mb, total_mb, speed_mbps)
            resume: Whether to attempt resuming partial downloads
            
        Returns:
            DownloadFileResult with download status and statistics
        """
        file_name = os.path.basename(output_path)
        self.logger.info(f"Starting download", file=file_name, url=url)
        
        start_time = time.time()
        
        # Attempt download with retry
        result = self._download_with_retry(
            url, 
            output_path, 
            progress_callback,
            resume,
            self.config.max_retries
        )
        
        duration = time.time() - start_time
        
        if result['success']:
            file_size = os.path.getsize(output_path)
            self.logger.info(
                f"Download completed successfully",
                file=file_name,
                size_mb=f"{file_size / 1024 / 1024:.2f}",
                duration_sec=f"{duration:.2f}"
            )
            return DownloadFileResult(
                success=True,
                file_path=output_path,
                size=file_size,
                duration=duration
            )
        else:
            self.logger.error(
                f"Download failed after {self.config.max_retries} attempts",
                file=file_name,
                error=result['error']
            )
            return DownloadFileResult(
                success=False,
                file_path=output_path,
                size=0,
                duration=duration,
                error=result['error']
            )
    
    def _download_with_retry(
        self,
        url: str,
        output_path: str,
        progress_callback: Optional[Callable],
        resume: bool,
        max_retries: int
    ) -> dict:
        """Download with automatic retry on failure.
        
        Args:
            url: File URL to download
            output_path: Local path to save file
            progress_callback: Optional callback for progress updates
            resume: Whether to attempt resuming partial downloads
            max_retries: Maximum number of retry attempts
            
        Returns:
            Dictionary with 'success' (bool) and 'error' (str) keys
        """
        file_name = os.path.basename(output_path)
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                # Check if we can resume
                resume_position = 0
                if resume and self.recovery_manager.can_resume(output_path, url):
                    resume_position = self.recovery_manager.get_resume_position(output_path)
                    self.logger.info(
                        f"Resuming download from byte {resume_position}",
                        file=file_name
                    )
                
                # Prepare headers for resume
                headers = {}
                if resume_position > 0:
                    headers['Range'] = f'bytes={resume_position}-'
                
                # Make request
                response = requests.get(url, stream=True, headers=headers, timeout=30)
                response.raise_for_status()
                
                # Get total size
                if resume_position > 0 and response.status_code == 206:
                    # Partial content - get size from Content-Range header
                    content_range = response.headers.get('Content-Range', '')
                    if content_range:
                        # Format: "bytes start-end/total"
                        total_size = int(content_range.split('/')[-1])
                    else:
                        total_size = int(response.headers.get('content-length', 0)) + resume_position
                else:
                    total_size = int(response.headers.get('content-length', 0))
                
                # Determine chunk size
                min_chunk = 64 * 1024  # 64 KB
                max_chunk = 4 * 1024 * 1024  # 4 MB
                block_size = max(min_chunk, min(total_size // 100, max_chunk)) if total_size else min_chunk
                
                # Open file for writing (append if resuming)
                mode = 'ab' if resume_position > 0 else 'wb'
                progress = resume_position
                
                # Ensure directory exists
                try:
                    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
                except OSError as e:
                    # Fail fast for filesystem errors
                    raise FileSystemError(
                        f"Cannot create output directory: {e}",
                        suggestion="Check directory permissions and available disk space"
                    )
                
                with open(output_path, mode) as file:
                    download_start_time = time.time()
                    last_update = download_start_time
                    
                    for chunk in response.iter_content(chunk_size=block_size):
                        if not chunk:
                            continue
                        
                        file.write(chunk)
                        progress += len(chunk)
                        
                        # Calculate progress
                        percentage = progress / total_size if total_size else 0
                        now = time.time()
                        
                        # Update progress every ~0.2s
                        if progress_callback and (now - last_update >= 0.2 or progress >= total_size):
                            elapsed = now - download_start_time
                            speed = (progress / 1024 / 1024) / elapsed if elapsed > 0 else 0.0  # MB/s
                            
                            downloaded_mb = progress / 1024 / 1024
                            total_mb = total_size / 1024 / 1024 if total_size else 0
                            
                            progress_callback(percentage, downloaded_mb, total_mb, speed)
                            last_update = now
                
                # Download successful
                return {'success': True, 'error': None}
                
            except (PermissionError, OSError) as e:
                # Filesystem errors - fail fast, don't retry
                error_category = categorize_error(e)
                if error_category == ErrorCategory.FILESYSTEM:
                    error_msg = f"Filesystem error: {e}"
                    self.logger.error(
                        f"Filesystem error (not retrying)",
                        file=file_name,
                        error=error_msg
                    )
                    return {'success': False, 'error': error_msg}
                # If not categorized as filesystem, treat as retryable
                last_error = e
                
            except Exception as e:
                last_error = e
                error_msg = str(e)
                
                # Check if error is retryable
                if not is_retryable_error(e):
                    # Non-retryable error - fail fast
                    self.logger.error(
                        f"Non-retryable error",
                        file=file_name,
                        error=error_msg
                    )
                    return {'success': False, 'error': error_msg}
                
                # Delete partial file on error (unless we're going to retry with resume)
                if os.path.exists(output_path) and not resume:
                    try:
                        os.remove(output_path)
                    except:
                        pass
                
                # Retry logic for retryable errors
                if attempt < max_retries:
                    self.logger.warning(
                        f"Download retry attempt {attempt}/{max_retries}",
                        file=file_name,
                        error=error_msg
                    )
                    time.sleep(self.config.retry_delay)
                else:
                    return {'success': False, 'error': error_msg}
        
        # Max retries exceeded
        final_error = str(last_error) if last_error else 'Max retries exceeded'
        return {'success': False, 'error': final_error}
