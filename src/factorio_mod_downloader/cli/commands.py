"""CLI command implementations for Factorio Mod Downloader."""

from pathlib import Path
from typing import Optional
from factorio_mod_downloader.infrastructure.config import ConfigManager


class ConfigCommands:
    """Configuration management commands."""
    
    def __init__(self, config_manager: ConfigManager, logger=None):
        """Initialize config commands.
        
        Args:
            config_manager: ConfigManager instance to use.
            logger: Optional LoggerSystem instance for logging.
        """
        self.config_manager = config_manager
        self.logger = logger
    
    def init(self) -> int:
        """Initialize default configuration file.
        
        Returns:
            Exit code (0 for success).
        """
        try:
            self.config_manager.init_config()
            print(f"Configuration file created at: {self.config_manager.config_path}")
            print("\nDefault configuration:")
            self._print_config_list()
            
            # Log configuration initialization
            if self.logger:
                self.logger.info(
                    "Configuration initialized",
                    path=str(self.config_manager.config_path)
                )
            
            return 0
        except Exception as e:
            print(f"Error: Failed to initialize configuration: {e}")
            if self.logger:
                self.logger.error(f"Failed to initialize configuration: {e}")
            return 1
    
    def get(self, key: str) -> int:
        """Get a configuration value.
        
        Args:
            key: Configuration key to retrieve.
            
        Returns:
            Exit code (0 for success, 1 for error).
        """
        try:
            value = self.config_manager.get(key)
            print(f"{key}: {value}")
            return 0
        except AttributeError as e:
            print(f"Error: {e}")
            print("\nAvailable configuration keys:")
            for k in self.config_manager.list_all().keys():
                print(f"  - {k}")
            return 1
        except Exception as e:
            print(f"Error: Failed to get configuration value: {e}")
            return 1
    
    def set(self, key: str, value: str) -> int:
        """Set a configuration value.
        
        Args:
            key: Configuration key to set.
            value: Value to set (as string, will be converted to appropriate type).
            
        Returns:
            Exit code (0 for success, 1 for error).
        """
        try:
            # Convert value to appropriate type based on current value type
            current_value = self.config_manager.get(key)
            converted_value = self._convert_value(value, type(current_value))
            
            # Set the value (with logging)
            self.config_manager.set(key, converted_value, logger=self.logger)
            
            # Save to file
            self.config_manager.save_config()
            
            print(f"Configuration updated: {key} = {converted_value}")
            print(f"Saved to: {self.config_manager.config_path}")
            return 0
        except AttributeError as e:
            print(f"Error: {e}")
            print("\nAvailable configuration keys:")
            for k in self.config_manager.list_all().keys():
                print(f"  - {k}")
            return 1
        except ValueError as e:
            print(f"Error: Invalid value for {key}: {e}")
            return 1
        except Exception as e:
            print(f"Error: Failed to set configuration value: {e}")
            return 1
    
    def list(self) -> int:
        """List all configuration values.
        
        Returns:
            Exit code (0 for success).
        """
        try:
            self._print_config_list()
            return 0
        except Exception as e:
            print(f"Error: Failed to list configuration: {e}")
            return 1
    
    def _print_config_list(self):
        """Print all configuration values in a formatted way."""
        config_dict = self.config_manager.list_all()
        
        print("Current configuration:")
        print("-" * 50)
        
        max_key_length = max(len(k) for k in config_dict.keys())
        
        for key, value in config_dict.items():
            print(f"  {key:<{max_key_length}} : {value}")
        
        print("-" * 50)
        print(f"Config file: {self.config_manager.config_path}")
    
    def _convert_value(self, value: str, target_type: type):
        """Convert string value to target type.
        
        Args:
            value: String value to convert.
            target_type: Target type to convert to.
            
        Returns:
            Converted value.
            
        Raises:
            ValueError: If conversion fails.
        """
        if target_type == bool:
            # Handle boolean conversion
            lower_value = value.lower()
            if lower_value in ('true', 'yes', '1', 'on'):
                return True
            elif lower_value in ('false', 'no', '0', 'off'):
                return False
            else:
                raise ValueError(
                    f"Cannot convert '{value}' to boolean. "
                    "Use: true/false, yes/no, 1/0, on/off"
                )
        elif target_type == int:
            try:
                return int(value)
            except ValueError:
                raise ValueError(f"Cannot convert '{value}' to integer")
        elif target_type == str:
            return value
        else:
            raise ValueError(f"Unsupported type: {target_type}")
