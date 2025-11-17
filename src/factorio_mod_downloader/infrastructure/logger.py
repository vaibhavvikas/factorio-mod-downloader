"""Structured logging system for Factorio Mod Downloader."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional


class LoggerSystem:
    """Structured logging system with file rotation and console output.
    
    Supports:
    - File logging with rotation (10MB max, 5 backups)
    - Console logging with configurable levels
    - DEBUG, INFO, WARNING, ERROR, CRITICAL levels
    - --quiet mode (only errors to console)
    - --verbose mode (debug output to console)
    """
    
    LOG_DIR = Path.home() / '.factorio-mod-downloader' / 'logs'
    LOG_FILE = 'factorio-mod-downloader.log'
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    BACKUP_COUNT = 5
    
    def __init__(self, log_level: str = 'INFO', console_level: Optional[str] = None, 
                 quiet: bool = False, verbose: bool = False):
        """Initialize the logging system.
        
        Args:
            log_level: Log level for file output (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            console_level: Log level for console output. If None, uses log_level.
            quiet: If True, suppress all console output except errors
            verbose: If True, enable DEBUG level console output
        """
        self.log_level = log_level.upper()
        
        # Determine console level based on flags
        if quiet:
            self.console_level = 'ERROR'
        elif verbose:
            self.console_level = 'DEBUG'
        elif console_level:
            self.console_level = console_level.upper()
        else:
            self.console_level = log_level.upper()
        
        self.logger = self._setup_logger()
    
    def _setup_logger(self) -> logging.Logger:
        """Set up logger with file and console handlers.
        
        Returns:
            Configured logger instance.
        """
        # Create logger
        logger = logging.getLogger('factorio_mod_downloader')
        logger.setLevel(logging.DEBUG)  # Capture all levels, handlers will filter
        
        # Remove existing handlers to avoid duplicates
        logger.handlers.clear()
        
        # Create log directory if it doesn't exist
        self.LOG_DIR.mkdir(parents=True, exist_ok=True)
        
        # File handler with rotation
        log_file_path = self.LOG_DIR / self.LOG_FILE
        file_handler = RotatingFileHandler(
            log_file_path,
            maxBytes=self.MAX_BYTES,
            backupCount=self.BACKUP_COUNT,
            encoding='utf-8'
        )
        file_handler.setLevel(getattr(logging, self.log_level))
        
        # File formatter with detailed information
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, self.console_level))
        
        # Console formatter (simpler than file)
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # Add handlers to logger
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def debug(self, message: str, **kwargs):
        """Log debug message.
        
        Args:
            message: Log message
            **kwargs: Additional context to include in log
        """
        if kwargs:
            message = f"{message} - {kwargs}"
        self.logger.debug(message)
    
    def info(self, message: str, **kwargs):
        """Log info message.
        
        Args:
            message: Log message
            **kwargs: Additional context to include in log
        """
        if kwargs:
            message = f"{message} - {kwargs}"
        self.logger.info(message)
    
    def warning(self, message: str, **kwargs):
        """Log warning message.
        
        Args:
            message: Log message
            **kwargs: Additional context to include in log
        """
        if kwargs:
            message = f"{message} - {kwargs}"
        self.logger.warning(message)
    
    def error(self, message: str, **kwargs):
        """Log error message.
        
        Args:
            message: Log message
            **kwargs: Additional context to include in log
        """
        if kwargs:
            message = f"{message} - {kwargs}"
        self.logger.error(message)
    
    def critical(self, message: str, **kwargs):
        """Log critical message.
        
        Args:
            message: Log message
            **kwargs: Additional context to include in log
        """
        if kwargs:
            message = f"{message} - {kwargs}"
        self.logger.critical(message)
    
    def set_console_level(self, level: str):
        """Change console log level dynamically.
        
        Args:
            level: New log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        level = level.upper()
        self.console_level = level
        
        # Update console handler level
        for handler in self.logger.handlers:
            if isinstance(handler, logging.StreamHandler) and not isinstance(handler, RotatingFileHandler):
                handler.setLevel(getattr(logging, level))
    
    def set_quiet(self):
        """Suppress all console output except errors."""
        self.set_console_level('ERROR')
    
    def set_verbose(self):
        """Enable verbose console output (DEBUG level)."""
        self.set_console_level('DEBUG')
    
    @classmethod
    def from_config(cls, config) -> 'LoggerSystem':
        """Create LoggerSystem from Config object.
        
        Args:
            config: Config object with log_level, quiet, and verbose settings
            
        Returns:
            Configured LoggerSystem instance
        """
        return cls(
            log_level=config.log_level,
            quiet=config.quiet,
            verbose=config.verbose
        )
