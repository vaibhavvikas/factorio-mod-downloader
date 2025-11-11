"""Configuration management for Factorio Mod Downloader."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
import os
import yaml


def get_default_factorio_mods_path() -> str:
    """Get the default Factorio mods directory path.
    
    Returns:
        Path to Factorio mods directory.
    """
    # Try to find Factorio mods directory
    if os.name == 'nt':  # Windows
        appdata = os.getenv('APPDATA')
        if appdata:
            factorio_mods = Path(appdata) / 'Factorio' / 'mods'
            return str(factorio_mods)
    else:  # Linux/Mac
        home = Path.home()
        # Linux
        factorio_mods = home / '.factorio' / 'mods'
        return str(factorio_mods)
        # Note: Mac uses same path as Linux for Factorio
    
    # Should not reach here, but return a sensible default
    return str(Path.home() / 'factorio' / 'mods')


@dataclass
class Config:
    """Configuration data class with validation."""
    
    default_output_path: str = field(default_factory=get_default_factorio_mods_path)
    include_optional_deps: bool = False
    max_retries: int = 3
    retry_delay: int = 2
    log_level: str = 'INFO'
    concurrent_downloads: int = 3
    quiet: bool = False
    verbose: bool = False
    json_output: bool = False
    
    def __post_init__(self):
        """Validate configuration values after initialization."""
        self._validate()
    
    def _validate(self):
        """Validate configuration values."""
        # Validate max_retries
        if not isinstance(self.max_retries, int) or self.max_retries < 0:
            raise ValueError(f"max_retries must be a non-negative integer, got {self.max_retries}")
        
        # Validate retry_delay
        if not isinstance(self.retry_delay, int) or self.retry_delay < 0:
            raise ValueError(f"retry_delay must be a non-negative integer, got {self.retry_delay}")
        
        # Validate log_level
        valid_log_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if self.log_level.upper() not in valid_log_levels:
            raise ValueError(
                f"log_level must be one of {valid_log_levels}, got {self.log_level}"
            )
        self.log_level = self.log_level.upper()
        
        # Validate concurrent_downloads
        if not isinstance(self.concurrent_downloads, int) or self.concurrent_downloads < 1:
            raise ValueError(
                f"concurrent_downloads must be a positive integer, got {self.concurrent_downloads}"
            )
        
        # Validate boolean fields
        if not isinstance(self.include_optional_deps, bool):
            raise ValueError(
                f"include_optional_deps must be a boolean, got {self.include_optional_deps}"
            )
        if not isinstance(self.quiet, bool):
            raise ValueError(f"quiet must be a boolean, got {self.quiet}")
        if not isinstance(self.verbose, bool):
            raise ValueError(f"verbose must be a boolean, got {self.verbose}")
        if not isinstance(self.json_output, bool):
            raise ValueError(f"json_output must be a boolean, got {self.json_output}")
        
        # Validate default_output_path is a string
        if not isinstance(self.default_output_path, str):
            raise ValueError(
                f"default_output_path must be a string, got {self.default_output_path}"
            )
    
    def to_dict(self) -> dict:
        """Convert config to dictionary for serialization."""
        return {
            'default_output_path': self.default_output_path,
            'include_optional_deps': self.include_optional_deps,
            'max_retries': self.max_retries,
            'retry_delay': self.retry_delay,
            'log_level': self.log_level,
            'concurrent_downloads': self.concurrent_downloads,
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Config':
        """Create Config from dictionary."""
        # Only use keys that are in the Config dataclass
        valid_keys = {
            'default_output_path', 'include_optional_deps', 'max_retries',
            'retry_delay', 'log_level', 'concurrent_downloads', 'quiet',
            'verbose', 'json_output'
        }
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)


class ConfigManager:
    """Manages application configuration."""
    
    DEFAULT_CONFIG_PATH = Path.home() / '.factorio-mod-downloader' / 'config.yaml'
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize ConfigManager.
        
        Args:
            config_path: Path to configuration file. If None, uses default path.
        """
        self.config_path = config_path or self.DEFAULT_CONFIG_PATH
        self.config = self._load_config()
    
    def _load_config(self) -> Config:
        """Load configuration from file or create default.
        
        Returns:
            Config object with loaded or default values.
        """
        if not self.config_path.exists():
            # Return default config if file doesn't exist
            return Config()
        
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data is None:
                    return Config()
                return Config.from_dict(data)
        except Exception as e:
            # If there's any error loading, return default config
            print(f"Warning: Could not load config from {self.config_path}: {e}")
            print("Using default configuration.")
            return Config()
    
    def save_config(self):
        """Save current configuration to file."""
        # Ensure directory exists
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save config to YAML file
        with open(self.config_path, 'w', encoding='utf-8') as f:
            yaml.safe_dump(
                self.config.to_dict(),
                f,
                default_flow_style=False,
                sort_keys=False
            )
    
    def get(self, key: str) -> Any:
        """Get configuration value.
        
        Args:
            key: Configuration key to retrieve.
            
        Returns:
            Configuration value.
            
        Raises:
            AttributeError: If key doesn't exist.
        """
        if not hasattr(self.config, key):
            raise AttributeError(f"Configuration key '{key}' does not exist")
        return getattr(self.config, key)
    
    def set(self, key: str, value: Any, logger=None):
        """Set configuration value.
        
        Args:
            key: Configuration key to set.
            value: Value to set.
            logger: Optional LoggerSystem instance for logging changes.
            
        Raises:
            AttributeError: If key doesn't exist.
            ValueError: If value is invalid for the key.
        """
        if not hasattr(self.config, key):
            raise AttributeError(f"Configuration key '{key}' does not exist")
        
        # Store old value for logging
        old_value = getattr(self.config, key)
        
        # Create a new config with the updated value to trigger validation
        config_dict = self.config.to_dict()
        config_dict[key] = value
        
        # This will validate the new value
        self.config = Config.from_dict(config_dict)
        
        # Log configuration change if logger provided
        if logger:
            logger.info(
                f"Configuration changed",
                key=key,
                old_value=old_value,
                new_value=value
            )
    
    def init_config(self):
        """Initialize default configuration file."""
        # Create default config
        self.config = Config()
        # Save to file
        self.save_config()
    
    def list_all(self) -> dict:
        """List all configuration values.
        
        Returns:
            Dictionary of all configuration values.
        """
        return self.config.to_dict()
