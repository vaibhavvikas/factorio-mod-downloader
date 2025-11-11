"""Dependency resolution for Factorio mods."""

from dataclasses import dataclass
from typing import List, Set

from factorio_mod_downloader.core.mod_info_fetcher import ModInfo, ModInfoFetcher
from factorio_mod_downloader.downloader.helpers import generate_anticache


# API Constants
BASE_DOWNLOAD_URL = "https://mods-storage.re146.dev"

# Reserved dependencies that should be skipped
RESERVED_DEPENDENCIES = {"space-age"}


@dataclass
class DependencyTree:
    """Tree structure representing mod dependencies."""
    root: ModInfo
    dependencies: List['DependencyTree']


class DependencyResolver:
    """Resolves mod dependencies recursively.
    
    This class extracts the dependency resolution logic from ModDownloader
    and makes it independent of GUI callbacks.
    """
    
    def __init__(self, logger, config):
        """Initialize DependencyResolver.
        
        Args:
            logger: LoggerSystem instance for logging
            config: Config object with settings
        """
        self.logger = logger
        self.config = config
        self.mod_info_fetcher = ModInfoFetcher(logger, config)
        self.analyzed_mods: Set[str] = set()
    
    def resolve_dependencies(
        self, 
        mod_url: str, 
        include_optional: bool = False
    ) -> DependencyTree:
        """Resolve all dependencies for a mod recursively.
        
        Args:
            mod_url: URL of the mod to analyze
            include_optional: Whether to include optional dependencies
            
        Returns:
            DependencyTree with the mod and all its dependencies
            
        Raises:
            Exception: If mod information cannot be fetched
        """
        # Initialize Selenium if not already done
        if not self.mod_info_fetcher.chrome_options:
            self.mod_info_fetcher.init_selenium()
        
        # Reset analyzed mods for new resolution
        self.analyzed_mods.clear()
        
        # Resolve the dependency tree
        return self._resolve_recursive(mod_url, include_optional)
    
    def _resolve_recursive(
        self, 
        mod_url: str, 
        include_optional: bool,
        is_optional: bool = False
    ) -> DependencyTree:
        """Recursively resolve dependencies for a mod.
        
        Args:
            mod_url: URL of the mod to analyze
            include_optional: Whether to include optional dependencies
            is_optional: Whether this mod is an optional dependency
            
        Returns:
            DependencyTree for this mod
            
        Raises:
            Exception: If mod information cannot be fetched
        """
        # Mark as analyzed to avoid circular dependencies
        if mod_url in self.analyzed_mods:
            self.logger.debug(f"Mod already analyzed: {mod_url}")
            # Return a placeholder - will be filtered out later
            return None
        
        self.analyzed_mods.add(mod_url)
        
        # Fetch mod information
        self.logger.info(f"Analyzing mod: {mod_url}")
        soup = self.mod_info_fetcher.get_page_source(mod_url)
        
        if not soup:
            raise Exception(f"Could not fetch page for {mod_url}")
        
        # Extract mod details
        mod_name = self.mod_info_fetcher.get_mod_name(soup)
        latest_version = self.mod_info_fetcher.get_latest_version(soup)
        
        if not mod_name or not latest_version:
            raise Exception(f"Could not get mod info for {mod_url}")
        
        # Skip reserved dependencies
        if mod_name in RESERVED_DEPENDENCIES:
            self.logger.warning(
                f"Skipping reserved dependency {mod_name}. "
                "Download manually if needed."
            )
            return None
        
        self.logger.info(
            f"Loaded mod {mod_name} with version {latest_version}",
            mod=mod_name,
            version=latest_version
        )
        
        # Construct download URL
        download_url = (
            f"{BASE_DOWNLOAD_URL}/{mod_name}/{latest_version}.zip"
            f"?anticache={generate_anticache()}"
        )
        
        # Create ModInfo for this mod
        mod_info = ModInfo(
            name=mod_name,
            version=latest_version,
            url=mod_url,
            download_url=download_url,
            is_optional=is_optional
        )
        
        # Fetch dependencies
        self.logger.info(f"Loading dependencies for {mod_name}")
        dependencies = self.mod_info_fetcher.get_required_dependencies(
            mod_name, 
            include_optional
        )
        
        if not dependencies:
            self.logger.info(f"No dependencies found for {mod_name}")
            return DependencyTree(root=mod_info, dependencies=[])
        
        dep_names = ", ".join([dep_name for dep_name, _ in dependencies])
        self.logger.info(
            f"Dependencies found for {mod_name}: {dep_names}",
            mod=mod_name,
            dependencies=dep_names,
            count=len(dependencies)
        )
        
        # Recursively resolve dependencies
        dep_trees = []
        for dep_name, dep_url in dependencies:
            if dep_url in self.analyzed_mods:
                self.logger.debug(f"Dependency already analyzed: {dep_name}")
                continue
            
            self.logger.info(f"Analyzing dependency {dep_name} of {mod_name}")
            
            try:
                dep_tree = self._resolve_recursive(dep_url, include_optional, is_optional=False)
                if dep_tree:  # Filter out None (reserved or circular dependencies)
                    dep_trees.append(dep_tree)
            except Exception as e:
                self.logger.error(
                    f"Error resolving dependency {dep_name}: {e}",
                    mod=mod_name,
                    dependency=dep_name
                )
                # Continue with other dependencies
        
        return DependencyTree(root=mod_info, dependencies=dep_trees)
    
    def get_download_list(self, tree: DependencyTree) -> List[ModInfo]:
        """Flatten dependency tree into download list.
        
        The list is ordered such that dependencies come before the mods
        that depend on them (depth-first traversal).
        
        Args:
            tree: DependencyTree to flatten
            
        Returns:
            List of ModInfo objects in download order
        """
        if not tree:
            return []
        
        download_list = []
        seen_mods = set()
        
        def _traverse(node: DependencyTree):
            """Depth-first traversal to build download list."""
            if not node:
                return
            
            # Process dependencies first
            for dep in node.dependencies:
                _traverse(dep)
            
            # Add this mod if not already seen
            if node.root.name not in seen_mods:
                download_list.append(node.root)
                seen_mods.add(node.root.name)
        
        _traverse(tree)
        return download_list
