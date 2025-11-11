"""CLI output formatting and progress display."""

import json
import sys
from typing import Any, Dict, Optional
from colorama import Fore, Style, init as colorama_init
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn, DownloadColumn, TransferSpeedColumn
from rich.console import Console

from factorio_mod_downloader.infrastructure.config import Config


# Initialize colorama for cross-platform colored output
colorama_init(autoreset=True)


class OutputFormatter:
    """Handles CLI output formatting and progress display."""
    
    def __init__(self, config: Config):
        """Initialize OutputFormatter.
        
        Args:
            config: Configuration object with output settings.
        """
        self.quiet = config.quiet
        self.verbose = config.verbose
        self.json_output = config.json_output
        self.use_colors = self._detect_color_support()
        self.console = Console()
    
    def _detect_color_support(self) -> bool:
        """Detect if terminal supports colored output.
        
        Returns:
            True if colors are supported, False otherwise.
        """
        # Disable colors in JSON mode or quiet mode
        if self.json_output or self.quiet:
            return False
        
        # Check if stdout is a terminal
        if not sys.stdout.isatty():
            return False
        
        # Check for common environment variables that indicate color support
        import os
        term = os.environ.get('TERM', '')
        colorterm = os.environ.get('COLORTERM', '')
        
        # Most modern terminals support colors
        if 'color' in term.lower() or colorterm:
            return True
        
        # Windows terminal and common Unix terminals
        if term in ('xterm', 'xterm-256color', 'screen', 'screen-256color', 
                   'tmux', 'tmux-256color', 'rxvt-unicode', 'rxvt-unicode-256color'):
            return True
        
        # Default to True on Windows (colorama handles it)
        if sys.platform == 'win32':
            return True
        
        return False
    
    def print_info(self, message: str):
        """Print informational message.
        
        Args:
            message: Message to print.
        """
        if self.quiet:
            return
        
        if self.json_output:
            self._print_json({'level': 'info', 'message': message})
        elif self.use_colors:
            print(f"{Fore.BLUE}ℹ {message}{Style.RESET_ALL}")
        else:
            print(f"[INFO] {message}")
    
    def print_success(self, message: str):
        """Print success message in green.
        
        Args:
            message: Message to print.
        """
        if self.quiet:
            return
        
        if self.json_output:
            self._print_json({'level': 'success', 'message': message})
        elif self.use_colors:
            print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")
        else:
            print(f"[SUCCESS] {message}")
    
    def print_error(self, message: str):
        """Print error message in red.
        
        Args:
            message: Message to print.
        """
        # Always print errors, even in quiet mode
        if self.json_output:
            self._print_json({'level': 'error', 'message': message})
        elif self.use_colors:
            print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}", file=sys.stderr)
        else:
            print(f"[ERROR] {message}", file=sys.stderr)
    
    def print_warning(self, message: str):
        """Print warning message in yellow.
        
        Args:
            message: Message to print.
        """
        if self.quiet:
            return
        
        if self.json_output:
            self._print_json({'level': 'warning', 'message': message})
        elif self.use_colors:
            print(f"{Fore.YELLOW}⚠ {message}{Style.RESET_ALL}")
        else:
            print(f"[WARNING] {message}")
    
    def _print_json(self, data: Dict[str, Any]):
        """Print data in JSON format.
        
        Args:
            data: Dictionary to print as JSON.
        """
        print(json.dumps(data))
    
    def create_progress_bar(self, total: int, desc: str) -> 'ProgressBar':
        """Create a progress bar for downloads.
        
        Args:
            total: Total number of units.
            desc: Description of the progress bar.
        
        Returns:
            ProgressBar instance.
        """
        # Disable progress bar in quiet mode, JSON mode, or non-interactive terminals
        disable = self.quiet or self.json_output or not sys.stdout.isatty()
        return ProgressBar(total, desc, disable=disable)
    
    def print_summary(self, stats: Dict[str, Any]):
        """Print download summary.
        
        Args:
            stats: Dictionary containing download statistics with keys:
                   - total_mods: Total number of mods processed
                   - successful: Number of successful downloads
                   - failed: Number of failed downloads
                   - skipped: Number of skipped mods
                   - total_size: Total size in bytes
                   - duration: Duration in seconds
                   - average_speed: Average speed in MB/s
        """
        if self.json_output:
            self.output_json(stats)
            return
        
        if self.quiet:
            return
        
        # Format size
        size_mb = stats.get('total_size', 0) / (1024 * 1024)
        duration = stats.get('duration', 0)
        avg_speed = stats.get('average_speed', 0)
        
        # Print summary
        print("\n" + "=" * 50)
        print("Download Summary")
        print("=" * 50)
        print(f"Total mods:      {stats.get('total_mods', 0)}")
        print(f"Successful:      {stats.get('successful', 0)}")
        print(f"Failed:          {stats.get('failed', 0)}")
        print(f"Skipped:         {stats.get('skipped', 0)}")
        print(f"Total size:      {size_mb:.2f} MB")
        print(f"Duration:        {duration:.2f} seconds")
        print(f"Average speed:   {avg_speed:.2f} MB/s")
        print("=" * 50)
    
    def output_json(self, data: Dict[str, Any]):
        """Output data in JSON format for machine parsing.
        
        Args:
            data: Dictionary to output as JSON.
        """
        print(json.dumps(data, indent=2))


class ProgressBar:
    """CLI progress bar wrapper using rich."""
    
    def __init__(self, total: int, desc: str, disable: bool = False):
        """Initialize progress bar.
        
        Args:
            total: Total number of units.
            desc: Description of the progress bar.
            disable: Whether to disable the progress bar.
        """
        self.total = total
        self.desc = desc
        self.disable = disable
        self.progress = None
        self.task_id = None
        
        if not self.disable:
            self.progress = Progress(
                TextColumn("[bold blue]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                DownloadColumn(),
                TransferSpeedColumn(),
                TimeRemainingColumn(),
            )
            self.progress.start()
            self.task_id = self.progress.add_task(self.desc, total=self.total)
    
    def update(self, n: int):
        """Update progress by n units.
        
        Args:
            n: Number of units to advance.
        """
        if not self.disable and self.progress and self.task_id is not None:
            self.progress.update(self.task_id, advance=n)
    
    def set_postfix(self, **kwargs):
        """Set progress bar postfix (speed, ETA, etc.).
        
        Args:
            **kwargs: Key-value pairs to display.
        """
        if not self.disable and self.progress and self.task_id is not None:
            # Update task description with postfix
            postfix_str = ", ".join(f"{k}={v}" for k, v in kwargs.items())
            if postfix_str:
                self.progress.update(self.task_id, description=f"{self.desc} ({postfix_str})")
    
    def close(self):
        """Close and finalize progress bar."""
        if not self.disable and self.progress:
            self.progress.stop()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


def create_progress_bar(total: int, desc: str, quiet: bool = False, 
                       json_output: bool = False) -> ProgressBar:
    """Create a progress bar for downloads.
    
    Args:
        total: Total number of units.
        desc: Description of the progress bar.
        quiet: Whether quiet mode is enabled.
        json_output: Whether JSON output mode is enabled.
    
    Returns:
        ProgressBar instance.
    """
    # Disable progress bar in quiet mode, JSON mode, or non-interactive terminals
    disable = quiet or json_output or not sys.stdout.isatty()
    return ProgressBar(total, desc, disable=disable)
