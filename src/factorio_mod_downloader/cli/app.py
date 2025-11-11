"""CLI application core for Factorio Mod Downloader."""

import argparse
import os
import sys
import time
import zipfile
from pathlib import Path
from typing import List, Optional

from factorio_mod_downloader.cli.output import OutputFormatter
from factorio_mod_downloader.cli.validators import (
    validate_mod_url,
    validate_batch_file,
    validate_directory_path
)
from factorio_mod_downloader.cli.error_formatter import (
    format_error_for_cli,
    format_multiple_errors
)
from factorio_mod_downloader.infrastructure.errors import (
    ValidationError,
    ModDownloaderError,
    get_error_suggestion
)
from factorio_mod_downloader.core.downloader import CoreDownloader
from factorio_mod_downloader.core.mod_info_fetcher import ModInfoFetcher
from factorio_mod_downloader.infrastructure.config import Config, ConfigManager
from factorio_mod_downloader.infrastructure.logger import LoggerSystem
from factorio_mod_downloader.infrastructure.registry import ModRegistry


class CLIApp:
    """Main CLI application coordinator.
    
    Handles command dispatch and orchestrates the interaction between
    configuration, logging, output formatting, and core download functionality.
    """
    
    def __init__(self, config: Config, logger: LoggerSystem):
        """Initialize CLIApp.
        
        Args:
            config: Configuration object with application settings.
            logger: LoggerSystem instance for logging.
        """
        self.config = config
        self.logger = logger
        self.output = OutputFormatter(config)
        self.config_manager = ConfigManager()
        self.registry = ModRegistry()
    
    def run(self, args: argparse.Namespace) -> int:
        """Execute CLI command and return exit code.
        
        Args:
            args: Parsed command-line arguments.
            
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        try:
            # Dispatch to appropriate command handler
            command = args.command
            
            if command == 'download':
                return self.download_single(args)
            elif command == 'batch':
                return self.download_batch(args)
            elif command == 'check-updates':
                return self.check_updates(args)
            elif command == 'update':
                return self.update_mods(args)
            elif command == 'config':
                return self.handle_config(args)
            elif command == 'validate':
                return self.validate(args)
            else:
                self.output.print_error(f"Unknown command: {command}")
                return 1
                
        except KeyboardInterrupt:
            self.output.print_warning("\nOperation cancelled by user")
            return 130  # Standard exit code for SIGINT
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}", exc_info=True)
            self.output.print_error(f"Unexpected error: {e}")
            return 1
    
    def handle_config(self, args: argparse.Namespace) -> int:
        """Handle config subcommands.
        
        Args:
            args: Parsed command-line arguments.
            
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        action = args.config_action
        
        try:
            if action == 'init':
                self.config_manager.init_config()
                self.output.print_success(
                    f"Configuration file created at {self.config_manager.config_path}"
                )
                return 0
                
            elif action == 'get':
                value = self.config_manager.get(args.key)
                if self.config.json_output:
                    self.output.output_json({args.key: value})
                else:
                    print(f"{args.key} = {value}")
                return 0
                
            elif action == 'set':
                # Convert value to appropriate type
                key = args.key
                value = args.value
                
                # Try to convert to appropriate type based on current value
                try:
                    current_value = self.config_manager.get(key)
                    if isinstance(current_value, bool):
                        value = value.lower() in ('true', '1', 'yes', 'on')
                    elif isinstance(current_value, int):
                        value = int(value)
                except (AttributeError, ValueError):
                    pass  # Keep as string
                
                self.config_manager.set(key, value, logger=self.logger)
                self.config_manager.save_config()
                self.output.print_success(f"Set {key} = {value}")
                return 0
                
            elif action == 'list':
                config_dict = self.config_manager.list_all()
                if self.config.json_output:
                    self.output.output_json(config_dict)
                else:
                    self.output.print_info("Current configuration:")
                    for key, value in config_dict.items():
                        print(f"  {key} = {value}")
                return 0
                
        except AttributeError as e:
            error_msg = format_error_for_cli(e, context="Invalid configuration key")
            self.output.print_error(error_msg)
            self.output.print_info("Use 'config list' to see available configuration keys")
            return 1
        except ValueError as e:
            error_msg = format_error_for_cli(e, context="Invalid configuration value")
            self.output.print_error(error_msg)
            return 1
        except Exception as e:
            self.logger.error(f"Configuration error: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Configuration error")
            self.output.print_error(error_msg)
            return 1
    
    def download_single(self, args: argparse.Namespace) -> int:
        """Download a single mod with dependencies.
        
        Args:
            args: Parsed command-line arguments containing:
                  - url: Mod URL to download
                  - output_path: Output directory (optional)
                  - include_optional: Include optional dependencies
                  - dry_run: Show what would be downloaded without downloading
                  - max_retries: Maximum retry attempts (optional)
                  
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        # Validate mod URL
        try:
            is_valid, error = validate_mod_url(args.url)
            if not is_valid:
                self.output.print_error(error)
                return 1
        except ValidationError as e:
            error_msg = format_error_for_cli(e, context="Invalid mod URL")
            self.output.print_error(error_msg)
            return 1
        
        # Determine output path
        output_path = args.output_path or self.config.default_output_path
        using_default_path = args.output_path is None
        
        # Check if using default path and it doesn't exist
        if using_default_path and not Path(output_path).exists():
            self.output.print_error(
                "Factorio default mods directory not found. "
                "Ensure you have Factorio installed and have run it at least once."
            )
            self.output.print_info(f"Expected directory: {output_path}")
            self.output.print_info(
                "Alternatively, specify a custom output directory with -o/--output"
            )
            return 1
        
        # Validate and create output directory (only for custom paths)
        try:
            is_valid, error = validate_directory_path(
                output_path, 
                must_exist=using_default_path,  # Must exist if using default
                create_if_missing=not using_default_path  # Only create if custom path
            )
            if not is_valid:
                self.output.print_error(error)
                return 1
        except Exception as e:
            error_msg = format_error_for_cli(e, context="Cannot access output directory")
            self.output.print_error(error_msg)
            return 1
        
        # Handle dry-run mode
        if hasattr(args, 'dry_run') and args.dry_run:
            return self._dry_run_download(args.url, output_path, args.include_optional)
        
        # Override max_retries if specified
        if hasattr(args, 'max_retries') and args.max_retries is not None:
            self.config.max_retries = args.max_retries
        
        # Log download start
        self.logger.info(f"Starting download: {args.url}")
        self.output.print_info(f"Downloading mod from: {args.url}")
        
        # Create progress callback
        current_mod = {'name': '', 'progress_bar': None, 'last_percentage': 0}
        
        def progress_callback(event_type, data):
            if event_type == 'analyzing':
                self.output.print_info(f"Analyzing dependencies for: {data}")
            elif event_type == 'downloading':
                mod_name, percentage, downloaded_mb, total_mb, speed = data
                # Start new progress bar for new mod
                if current_mod['name'] != mod_name:
                    if current_mod['progress_bar']:
                        current_mod['progress_bar'].close()
                    current_mod['name'] = mod_name
                    current_mod['last_percentage'] = 0
                    # Don't create progress bar in quiet or JSON mode
                    if not self.config.quiet and not self.config.json_output:
                        current_mod['progress_bar'] = self.output.create_progress_bar(
                            total=100,
                            desc=f"Downloading {mod_name}"
                        )
                # Update progress
                if current_mod['progress_bar']:
                    advance = int(percentage) - current_mod['last_percentage']
                    if advance > 0:
                        current_mod['progress_bar'].update(advance)
                        current_mod['last_percentage'] = int(percentage)
            elif event_type == 'complete':
                if current_mod['progress_bar']:
                    current_mod['progress_bar'].close()
                    current_mod['progress_bar'] = None
                self.output.print_success(f"Downloaded: {data}")
                current_mod['name'] = ''
                current_mod['last_percentage'] = 0
            elif event_type == 'error':
                mod_name, error_msg = data
                if current_mod['progress_bar']:
                    current_mod['progress_bar'].close()
                    current_mod['progress_bar'] = None
                self.output.print_error(f"Failed to download {mod_name}: {error_msg}")
                current_mod['name'] = ''
                current_mod['last_percentage'] = 0
        
        # Create downloader
        try:
            downloader = CoreDownloader(
                output_path=output_path,
                include_optional=args.include_optional,
                logger=self.logger,
                config=self.config,
                progress_callback=progress_callback
            )
            
            # Download mod
            result = downloader.download_mod(args.url)
            
            # Close any remaining progress bar
            if current_mod['progress_bar']:
                current_mod['progress_bar'].close()
            
            # Display results
            if result.success:
                self.output.print_success(
                    f"Successfully downloaded {len(result.downloaded_mods)} mod(s)"
                )
                
                # Display summary
                stats = {
                    'total_mods': len(result.downloaded_mods) + len(result.failed_mods),
                    'successful': len(result.downloaded_mods),
                    'failed': len(result.failed_mods),
                    'skipped': 0,
                    'total_size': result.total_size,
                    'duration': result.duration,
                    'average_speed': result.total_size / result.duration / (1024 * 1024) if result.duration > 0 else 0
                }
                self.output.print_summary(stats)
                
                # Update registry
                if result.downloaded_mods:
                    self.registry.scan_directory(Path(output_path))
                    self.registry.save_registry()
                
                return 0
            else:
                self.output.print_error("Download failed")
                if result.failed_mods:
                    self.output.print_error("Failed mods:")
                    for mod_name, error in result.failed_mods:
                        self.output.print_error(f"  - {mod_name}: {error}")
                return 1
                
        except ModDownloaderError as e:
            # Close any remaining progress bar
            if current_mod['progress_bar']:
                current_mod['progress_bar'].close()
            self.logger.error(f"Error during download: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Download failed")
            self.output.print_error(error_msg)
            return 1
        except Exception as e:
            # Close any remaining progress bar
            if current_mod['progress_bar']:
                current_mod['progress_bar'].close()
            self.logger.error(f"Unexpected error during download: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Unexpected error during download")
            self.output.print_error(error_msg)
            return 1
    
    def _dry_run_download(self, mod_url: str, output_path: str, include_optional: bool) -> int:
        """Perform a dry-run download (show what would be downloaded).
        
        Args:
            mod_url: Mod URL to analyze.
            output_path: Output directory.
            include_optional: Include optional dependencies.
            
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        self.output.print_info("Dry-run mode: analyzing dependencies...")
        
        try:
            downloader = CoreDownloader(
                output_path=output_path,
                include_optional=include_optional,
                logger=self.logger,
                config=self.config
            )
            
            plan = downloader.get_download_plan(mod_url)
            
            # Display plan
            self.output.print_info(f"\nWould download {plan.total_count} mod(s):")
            for mod in plan.mods_to_download:
                size_str = f" ({mod.size / 1024 / 1024:.2f} MB)" if mod.size else ""
                optional_str = " [optional]" if mod.is_optional else ""
                print(f"  - {mod.name} v{mod.version}{size_str}{optional_str}")
            
            if plan.estimated_size > 0:
                total_mb = plan.estimated_size / 1024 / 1024
                self.output.print_info(f"\nEstimated total size: {total_mb:.2f} MB")
            
            return 0
            
        except Exception as e:
            self.logger.error(f"Error during dry-run: {e}")
            self.output.print_error(f"Error analyzing dependencies: {e}")
            return 1
    
    def download_batch(self, args: argparse.Namespace) -> int:
        """Download multiple mods from a batch file.
        
        Args:
            args: Parsed command-line arguments containing:
                  - file: Path to batch file
                  - output_path: Output directory (optional)
                  - include_optional: Include optional dependencies
                  - continue_on_error: Continue on errors
                  
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        # Validate batch file
        is_valid, error = validate_batch_file(args.file)
        if not is_valid:
            self.output.print_error(error)
            return 1
        
        # Determine output path
        output_path = args.output_path or self.config.default_output_path
        using_default_path = args.output_path is None
        
        # Check if using default path and it doesn't exist
        if using_default_path and not Path(output_path).exists():
            self.output.print_error(
                "Factorio default mods directory not found. "
                "Ensure you have Factorio installed and have run it at least once."
            )
            self.output.print_info(f"Expected directory: {output_path}")
            self.output.print_info(
                "Alternatively, specify a custom output directory with -o/--output"
            )
            return 1
        
        # Validate and create output directory (only for custom paths)
        is_valid, error = validate_directory_path(
            output_path,
            must_exist=using_default_path,  # Must exist if using default
            create_if_missing=not using_default_path  # Only create if custom path
        )
        if not is_valid:
            self.output.print_error(error)
            return 1
        
        # Read batch file (JSON format)
        try:
            import json
            with open(args.file, 'r', encoding='utf-8') as f:
                batch_data = json.load(f)
        except json.JSONDecodeError as e:
            self.output.print_error(f"Invalid JSON format in batch file: {e}")
            self.output.print_info("Batch file must be valid JSON. See documentation for format.")
            return 1
        except Exception as e:
            self.output.print_error(f"Error reading batch file: {e}")
            return 1
        
        # Parse URLs from JSON batch file
        urls = []
        if isinstance(batch_data, dict):
            # Support {"mods": [...]} format
            if 'mods' in batch_data:
                mods_list = batch_data['mods']
                if isinstance(mods_list, list):
                    for item in mods_list:
                        if isinstance(item, str):
                            urls.append(item)
                        elif isinstance(item, dict) and 'url' in item:
                            urls.append(item['url'])
            else:
                self.output.print_error("JSON batch file must contain a 'mods' array")
                return 1
        elif isinstance(batch_data, list):
            # Support direct array format
            for item in batch_data:
                if isinstance(item, str):
                    urls.append(item)
                elif isinstance(item, dict) and 'url' in item:
                    urls.append(item['url'])
        else:
            self.output.print_error("Invalid batch file format. Must be JSON object or array.")
            return 1
        
        # Deduplicate URLs while preserving order
        seen = set()
        unique_urls = []
        for url in urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
        
        if not unique_urls:
            self.output.print_error("No valid URLs found in batch file")
            return 1
        
        # Log batch download start
        self.logger.info(f"Starting batch download of {len(unique_urls)} mods")
        self.output.print_info(f"Processing {len(unique_urls)} mod(s) from batch file")
        
        # Track statistics
        total_mods = 0
        successful_downloads = 0
        failed_downloads = 0
        skipped_mods = 0
        total_size = 0
        start_time = time.time()
        failed_list = []
        
        # Download each mod
        for i, url in enumerate(unique_urls, 1):
            self.output.print_info(f"\n[{i}/{len(unique_urls)}] Processing: {url}")
            
            # Create a mock args object for download_single
            class BatchArgs:
                def __init__(self, url, output_path, include_optional):
                    self.url = url
                    self.output_path = output_path
                    self.include_optional = include_optional
                    self.dry_run = False
                    self.max_retries = None
            
            batch_args = BatchArgs(url, output_path, args.include_optional)
            
            try:
                # Create downloader for this mod
                downloader = CoreDownloader(
                    output_path=output_path,
                    include_optional=args.include_optional,
                    logger=self.logger,
                    config=self.config,
                    progress_callback=None  # Simplified for batch mode
                )
                
                # Download the mod
                result = downloader.download_mod(url)
                
                # Update statistics
                total_mods += len(result.downloaded_mods) + len(result.failed_mods)
                successful_downloads += len(result.downloaded_mods)
                failed_downloads += len(result.failed_mods)
                total_size += result.total_size
                
                # Track failures
                if result.failed_mods:
                    for mod_name, error in result.failed_mods:
                        failed_list.append((url, mod_name, error))
                
                # Display result for this URL
                if result.success:
                    self.output.print_success(
                        f"Downloaded {len(result.downloaded_mods)} mod(s) from {url}"
                    )
                else:
                    self.output.print_error(f"Failed to download from {url}")
                    if not args.continue_on_error:
                        self.output.print_error("Stopping batch download (use --continue-on-error to continue)")
                        break
                        
            except Exception as e:
                self.logger.error(f"Error downloading {url}: {e}")
                self.output.print_error(f"Error downloading {url}: {e}")
                failed_downloads += 1
                failed_list.append((url, url.split('/')[-1], str(e)))
                
                if not args.continue_on_error:
                    self.output.print_error("Stopping batch download (use --continue-on-error to continue)")
                    break
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Display summary
        self.output.print_info("\n" + "=" * 50)
        self.output.print_info("Batch Download Summary")
        self.output.print_info("=" * 50)
        
        stats = {
            'total_mods': total_mods,
            'successful': successful_downloads,
            'failed': failed_downloads,
            'skipped': skipped_mods,
            'total_size': total_size,
            'duration': duration,
            'average_speed': total_size / duration / (1024 * 1024) if duration > 0 else 0
        }
        
        self.output.print_summary(stats)
        
        # Display failed mods if any
        if failed_list:
            self.output.print_error(f"\nFailed downloads ({len(failed_list)}):")
            for url, mod_name, error in failed_list:
                # Try to provide helpful suggestion
                suggestion = get_error_suggestion(Exception(error))
                if suggestion:
                    self.output.print_error(f"  - {mod_name}: {error}")
                    self.output.print_info(f"    💡 {suggestion}")
                else:
                    self.output.print_error(f"  - {mod_name}: {error}")
        
        # Update registry
        if successful_downloads > 0:
            self.registry.scan_directory(Path(output_path))
            self.registry.save_registry()
        
        # Return exit code
        if failed_downloads > 0:
            return 1
        return 0
    
    def check_updates(self, args: argparse.Namespace) -> int:
        """Check for mod updates in a directory.
        
        Args:
            args: Parsed command-line arguments containing:
                  - directory: Directory to scan for mods
                  
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        # Validate directory
        is_valid, error = validate_directory_path(args.directory, must_exist=True)
        if not is_valid:
            self.output.print_error(error)
            return 1
        
        directory = Path(args.directory)
        
        # Scan directory for mods
        self.output.print_info(f"Scanning directory: {directory}")
        self.logger.info(f"Scanning directory for mods: {directory}")
        
        try:
            # Use registry to scan directory
            found_mods = self.registry.scan_directory(directory)
            
            if not found_mods:
                self.output.print_warning("No mod files found in directory")
                return 0
            
            self.output.print_info(f"Found {len(found_mods)} mod(s)")
            
            # Check for updates
            self.output.print_info("Checking for updates...")
            
            mod_info_fetcher = ModInfoFetcher(self.logger, self.config)
            updates_available = []
            
            for mod_entry in found_mods:
                try:
                    # Construct mod URL
                    mod_url = f"https://mods.factorio.com/mod/{mod_entry.name}"
                    
                    # Get latest version from mod portal
                    self.logger.debug(f"Checking {mod_entry.name} for updates")
                    latest_version = mod_info_fetcher.get_latest_version(mod_url)
                    
                    # Compare versions
                    if latest_version and latest_version != mod_entry.version:
                        updates_available.append({
                            'name': mod_entry.name,
                            'current_version': mod_entry.version,
                            'latest_version': latest_version,
                            'url': mod_url
                        })
                        self.logger.info(
                            f"Update available for {mod_entry.name}",
                            current=mod_entry.version,
                            latest=latest_version
                        )
                    
                except Exception as e:
                    self.logger.warning(f"Could not check updates for {mod_entry.name}: {e}")
                    self.output.print_warning(f"Could not check {mod_entry.name}: {e}")
            
            # Display results
            if updates_available:
                self.output.print_info(f"\nUpdates available for {len(updates_available)} mod(s):")
                
                if self.config.json_output:
                    self.output.output_json({'updates': updates_available})
                else:
                    for update in updates_available:
                        print(f"  - {update['name']}: {update['current_version']} → {update['latest_version']}")
                
                self.output.print_info(
                    f"\nTo update, run: factorio-mod-downloader update {directory}"
                )
            else:
                self.output.print_success("All mods are up to date!")
            
            return 0
            
        except Exception as e:
            self.logger.error(f"Error checking for updates: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Failed to check for updates")
            self.output.print_error(error_msg)
            return 1
    
    def update_mods(self, args: argparse.Namespace) -> int:
        """Update mods to latest versions.
        
        Args:
            args: Parsed command-line arguments containing:
                  - directory: Directory containing mods
                  - mod_name: Specific mod to update (optional)
                  - replace: Replace old versions
                  
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        # Validate directory
        is_valid, error = validate_directory_path(args.directory, must_exist=True)
        if not is_valid:
            self.output.print_error(error)
            return 1
        
        directory = Path(args.directory)
        
        # Scan directory for mods
        self.output.print_info(f"Scanning directory: {directory}")
        self.logger.info(f"Scanning directory for mods: {directory}")
        
        try:
            # Use registry to scan directory
            found_mods = self.registry.scan_directory(directory)
            
            if not found_mods:
                self.output.print_warning("No mod files found in directory")
                return 0
            
            # Filter by specific mod if requested
            if hasattr(args, 'mod_name') and args.mod_name:
                found_mods = [m for m in found_mods if m.name == args.mod_name]
                if not found_mods:
                    self.output.print_error(f"Mod not found: {args.mod_name}")
                    return 1
                self.output.print_info(f"Updating specific mod: {args.mod_name}")
            else:
                self.output.print_info(f"Found {len(found_mods)} mod(s)")
            
            # Check for updates
            self.output.print_info("Checking for updates...")
            
            mod_info_fetcher = ModInfoFetcher(self.logger, self.config)
            updates_to_download = []
            
            for mod_entry in found_mods:
                try:
                    # Construct mod URL
                    mod_url = f"https://mods.factorio.com/mod/{mod_entry.name}"
                    
                    # Get latest version from mod portal
                    self.logger.debug(f"Checking {mod_entry.name} for updates")
                    latest_version = mod_info_fetcher.get_latest_version(mod_url)
                    
                    # Compare versions
                    if latest_version and latest_version != mod_entry.version:
                        updates_to_download.append({
                            'name': mod_entry.name,
                            'current_version': mod_entry.version,
                            'latest_version': latest_version,
                            'url': mod_url,
                            'old_file': mod_entry.file_path
                        })
                        self.logger.info(
                            f"Update available for {mod_entry.name}",
                            current=mod_entry.version,
                            latest=latest_version
                        )
                    
                except Exception as e:
                    self.logger.warning(f"Could not check updates for {mod_entry.name}: {e}")
                    self.output.print_warning(f"Could not check {mod_entry.name}: {e}")
            
            # Check if any updates found
            if not updates_to_download:
                self.output.print_success("All mods are up to date!")
                return 0
            
            # Display updates to download
            self.output.print_info(f"\nFound {len(updates_to_download)} update(s):")
            for update in updates_to_download:
                print(f"  - {update['name']}: {update['current_version']} → {update['latest_version']}")
            
            # Download updates
            self.output.print_info("\nDownloading updates...")
            
            successful_updates = 0
            failed_updates = []
            
            for update in updates_to_download:
                self.output.print_info(f"\nUpdating {update['name']}...")
                
                try:
                    # Create downloader
                    downloader = CoreDownloader(
                        output_path=str(directory),
                        include_optional=False,  # Don't include optional deps for updates
                        logger=self.logger,
                        config=self.config,
                        progress_callback=None
                    )
                    
                    # Download the update
                    result = downloader.download_mod(update['url'])
                    
                    if result.success and result.downloaded_mods:
                        successful_updates += 1
                        self.output.print_success(f"Updated {update['name']} to {update['latest_version']}")
                        
                        # Replace old version if requested
                        if args.replace:
                            try:
                                old_file = Path(update['old_file'])
                                if old_file.exists():
                                    old_file.unlink()
                                    self.output.print_info(f"Removed old version: {old_file.name}")
                                    self.logger.info(f"Removed old version: {old_file}")
                            except Exception as e:
                                self.logger.warning(f"Could not remove old version: {e}")
                                self.output.print_warning(f"Could not remove old version: {e}")
                    else:
                        failed_updates.append((update['name'], "Download failed"))
                        self.output.print_error(f"Failed to update {update['name']}")
                        
                except Exception as e:
                    self.logger.error(f"Error updating {update['name']}: {e}")
                    failed_updates.append((update['name'], str(e)))
                    self.output.print_error(f"Error updating {update['name']}: {e}")
            
            # Display summary
            self.output.print_info("\n" + "=" * 50)
            self.output.print_info("Update Summary")
            self.output.print_info("=" * 50)
            print(f"  Successful: {successful_updates}")
            print(f"  Failed:     {len(failed_updates)}")
            
            if failed_updates:
                self.output.print_error("\nFailed updates:")
                for mod_name, error in failed_updates:
                    self.output.print_error(f"  - {mod_name}: {error}")
            
            # Update registry
            if successful_updates > 0:
                self.registry.scan_directory(directory)
                self.registry.save_registry()
            
            # Return exit code
            if failed_updates:
                return 1
            return 0
            
        except Exception as e:
            self.logger.error(f"Error updating mods: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Failed to update mods")
            self.output.print_error(error_msg)
            return 1
    
    def validate(self, args: argparse.Namespace) -> int:
        """Validate downloaded mod files.
        
        Args:
            args: Parsed command-line arguments containing:
                  - directory: Directory to validate
                  
        Returns:
            Exit code (0 for success, non-zero for failure).
        """
        # Validate directory
        is_valid, error = validate_directory_path(args.directory, must_exist=True)
        if not is_valid:
            self.output.print_error(error)
            return 1
        
        directory = Path(args.directory)
        
        # Scan directory for mod files
        self.output.print_info(f"Scanning directory: {directory}")
        self.logger.info(f"Validating mod files in: {directory}")
        
        try:
            # Find all .zip files in directory
            mod_files = list(directory.glob('*.zip'))
            
            if not mod_files:
                self.output.print_warning("No mod files found in directory")
                return 0
            
            self.output.print_info(f"Found {len(mod_files)} mod file(s)")
            self.output.print_info("Validating ZIP file integrity...")
            
            # Validate each file
            valid_files = []
            corrupted_files = []
            
            for mod_file in mod_files:
                try:
                    # Try to open and test the ZIP file
                    with zipfile.ZipFile(mod_file, 'r') as zf:
                        # Test the ZIP file integrity
                        bad_file = zf.testzip()
                        
                        if bad_file:
                            corrupted_files.append((mod_file.name, f"Corrupted file in archive: {bad_file}"))
                            self.logger.warning(f"Corrupted mod file: {mod_file.name}")
                        else:
                            valid_files.append(mod_file.name)
                            self.logger.debug(f"Valid mod file: {mod_file.name}")
                            
                except zipfile.BadZipFile:
                    corrupted_files.append((mod_file.name, "Invalid ZIP file format"))
                    self.logger.warning(f"Invalid ZIP file: {mod_file.name}")
                except Exception as e:
                    corrupted_files.append((mod_file.name, str(e)))
                    self.logger.warning(f"Error validating {mod_file.name}: {e}")
            
            # Display results
            self.output.print_info("\n" + "=" * 50)
            self.output.print_info("Validation Results")
            self.output.print_info("=" * 50)
            print(f"  Total files:     {len(mod_files)}")
            print(f"  Valid files:     {len(valid_files)}")
            print(f"  Corrupted files: {len(corrupted_files)}")
            self.output.print_info("=" * 50)
            
            # Display corrupted files
            if corrupted_files:
                self.output.print_error(f"\nCorrupted mod files ({len(corrupted_files)}):")
                for file_name, error in corrupted_files:
                    self.output.print_error(f"  - {file_name}: {error}")
                
                self.output.print_info("\nSuggestion: Re-download corrupted mods using:")
                self.output.print_info("  factorio-mod-downloader download <mod_url>")
                
                # Output JSON if requested
                if self.config.json_output:
                    self.output.output_json({
                        'total': len(mod_files),
                        'valid': len(valid_files),
                        'corrupted': len(corrupted_files),
                        'corrupted_files': [
                            {'file': name, 'error': error}
                            for name, error in corrupted_files
                        ]
                    })
                
                return 1
            else:
                self.output.print_success("\nAll mod files are valid!")
                
                # Output JSON if requested
                if self.config.json_output:
                    self.output.output_json({
                        'total': len(mod_files),
                        'valid': len(valid_files),
                        'corrupted': 0,
                        'corrupted_files': []
                    })
                
                return 0
                
        except Exception as e:
            self.logger.error(f"Error validating mod files: {e}", exc_info=True)
            error_msg = format_error_for_cli(e, context="Validation failed")
            self.output.print_error(error_msg)
            return 1



def cli_main(args: List[str]) -> int:
    """CLI entry point.
    
    Initializes configuration and logging, parses arguments,
    creates and runs the CLI application.
    
    Args:
        args: Command-line arguments (excluding program name).
        
    Returns:
        Exit code (0 for success, non-zero for failure).
    """
    from factorio_mod_downloader.cli.parser import parse_args
    
    try:
        # Parse command-line arguments
        parsed_args = parse_args(args)
        
        # Initialize configuration manager
        config_manager = ConfigManager()
        config = config_manager.config
        
        # Override config with command-line arguments
        if hasattr(parsed_args, 'log_level') and parsed_args.log_level:
            config.log_level = parsed_args.log_level
        
        if hasattr(parsed_args, 'quiet') and parsed_args.quiet:
            config.quiet = True
        
        if hasattr(parsed_args, 'verbose') and parsed_args.verbose:
            config.verbose = True
            config.log_level = 'DEBUG'
        
        if hasattr(parsed_args, 'json_output') and parsed_args.json_output:
            config.json_output = True
        
        # Initialize logging system
        console_level = None
        if config.quiet:
            console_level = 'ERROR'
        elif config.verbose:
            console_level = 'DEBUG'
        
        logger = LoggerSystem(
            log_level=config.log_level,
            console_level=console_level
        )
        
        # Log startup
        logger.info("Factorio Mod Downloader CLI started")
        logger.debug(f"Arguments: {args}")
        
        # Create and run CLI application
        app = CLIApp(config, logger)
        exit_code = app.run(parsed_args)
        
        # Log shutdown
        logger.info(f"CLI exiting with code {exit_code}")
        
        return exit_code
        
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        return 130  # Standard exit code for SIGINT
    
    except ValidationError as e:
        # Handle validation errors with helpful messages
        from factorio_mod_downloader.cli.error_formatter import format_error_for_cli
        error_msg = format_error_for_cli(e, context="Invalid input")
        print(error_msg, file=sys.stderr)
        return 1
        
    except Exception as e:
        # Handle top-level exceptions
        from factorio_mod_downloader.cli.error_formatter import format_error_for_cli
        error_msg = format_error_for_cli(e, context="Fatal error")
        print(error_msg, file=sys.stderr)
        
        # Try to log if logger is available
        try:
            if 'logger' in locals():
                logger.critical(f"Fatal error: {e}", exc_info=True)
        except:
            pass
        
        return 1
