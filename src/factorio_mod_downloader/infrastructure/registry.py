"""Mod registry for tracking downloaded mods and their versions."""

import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import re


@dataclass
class ModEntry:
    """Registry entry for a mod.
    
    Attributes:
        name: Mod name
        version: Mod version
        file_path: Path to the mod file
        download_date: Date when the mod was downloaded
        size: File size in bytes
    """
    
    name: str
    version: str
    file_path: str
    download_date: str  # ISO format datetime string
    size: int
    
    def to_dict(self) -> dict:
        """Convert ModEntry to dictionary for serialization."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ModEntry':
        """Create ModEntry from dictionary."""
        return cls(**data)


class ModRegistry:
    """Registry of downloaded mods with JSON persistence.
    
    Maintains a local database of downloaded mods at
    ~/.factorio-mod-downloader/mod_registry.json
    """
    
    REGISTRY_PATH = Path.home() / '.factorio-mod-downloader' / 'mod_registry.json'
    
    def __init__(self, registry_path: Optional[Path] = None):
        """Initialize ModRegistry.
        
        Args:
            registry_path: Path to registry file. If None, uses default path.
        """
        self.registry_path = registry_path or self.REGISTRY_PATH
        self.registry: Dict[str, ModEntry] = self._load_registry()
    
    def _load_registry(self) -> Dict[str, ModEntry]:
        """Load registry from file.
        
        Returns:
            Dictionary mapping mod names to ModEntry objects.
        """
        if not self.registry_path.exists():
            return {}
        
        try:
            with open(self.registry_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {
                    name: ModEntry.from_dict(entry_data)
                    for name, entry_data in data.items()
                }
        except Exception as e:
            print(f"Warning: Could not load registry from {self.registry_path}: {e}")
            print("Starting with empty registry.")
            return {}
    
    def save_registry(self):
        """Save registry to file."""
        # Ensure directory exists
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert registry to serializable format
        data = {
            name: entry.to_dict()
            for name, entry in self.registry.items()
        }
        
        # Save to JSON file
        with open(self.registry_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def add_mod(self, mod_name: str, version: str, file_path: str, size: int = 0):
        """Add or update a mod in the registry.
        
        Args:
            mod_name: Name of the mod
            version: Version of the mod
            file_path: Path to the mod file
            size: File size in bytes (default: 0, will be calculated if file exists)
        """
        # Calculate size if not provided and file exists
        if size == 0:
            path = Path(file_path)
            if path.exists():
                size = path.stat().st_size
        
        # Create mod entry
        entry = ModEntry(
            name=mod_name,
            version=version,
            file_path=file_path,
            download_date=datetime.now().isoformat(),
            size=size
        )
        
        # Add to registry (overwrites if exists)
        self.registry[mod_name] = entry
    
    def get_mod(self, mod_name: str) -> Optional[ModEntry]:
        """Get mod information from registry.
        
        Args:
            mod_name: Name of the mod to retrieve
            
        Returns:
            ModEntry if found, None otherwise
        """
        return self.registry.get(mod_name)
    
    def list_mods(self) -> List[ModEntry]:
        """List all registered mods.
        
        Returns:
            List of all ModEntry objects in the registry
        """
        return list(self.registry.values())
    
    def scan_directory(self, directory: Path) -> List[ModEntry]:
        """Scan directory for mod files and update registry.
        
        Parses mod filenames to extract name and version.
        Expected format: modname_version.zip
        
        Args:
            directory: Directory to scan for mod files
            
        Returns:
            List of ModEntry objects for mods found in directory
        """
        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")
        
        if not directory.is_dir():
            raise NotADirectoryError(f"Not a directory: {directory}")
        
        found_mods = []
        
        # Find all .zip files in directory
        for file_path in directory.glob('*.zip'):
            # Parse filename to extract mod name and version
            mod_info = self._parse_mod_filename(file_path.name)
            
            if mod_info:
                mod_name, version = mod_info
                size = file_path.stat().st_size
                
                # Add to registry
                self.add_mod(
                    mod_name=mod_name,
                    version=version,
                    file_path=str(file_path),
                    size=size
                )
                
                # Add to found mods list
                found_mods.append(self.registry[mod_name])
        
        # Save updated registry
        if found_mods:
            self.save_registry()
        
        return found_mods
    
    def _parse_mod_filename(self, filename: str) -> Optional[tuple[str, str]]:
        """Parse mod filename to extract name and version.
        
        Expected format: modname_version.zip
        Examples:
            - Krastorio2_1.3.24.zip -> ("Krastorio2", "1.3.24")
            - space-exploration_0.6.138.zip -> ("space-exploration", "0.6.138")
        
        Args:
            filename: Mod filename to parse
            
        Returns:
            Tuple of (mod_name, version) if successful, None otherwise
        """
        # Remove .zip extension
        if not filename.endswith('.zip'):
            return None
        
        name_without_ext = filename[:-4]
        
        # Pattern: modname_version
        # Version typically contains numbers and dots, may have letters
        # Split on last underscore to handle mod names with underscores
        parts = name_without_ext.rsplit('_', 1)
        
        if len(parts) != 2:
            return None
        
        mod_name, version = parts
        
        # Validate version format (should contain at least one digit)
        if not re.search(r'\d', version):
            return None
        
        return (mod_name, version)
    
    def remove_mod(self, mod_name: str) -> bool:
        """Remove a mod from the registry.
        
        Args:
            mod_name: Name of the mod to remove
            
        Returns:
            True if mod was removed, False if not found
        """
        if mod_name in self.registry:
            del self.registry[mod_name]
            return True
        return False
    
    def clear(self):
        """Clear all entries from the registry."""
        self.registry.clear()
