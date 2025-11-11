# Requirements Document

## Introduction

This document specifies the requirements for adding a comprehensive Command-Line Interface (CLI) to the Factorio Mod Downloader application. The CLI Update SHALL provide feature parity with the existing GUI while adding advanced capabilities including configuration management, structured logging, error recovery, mod update checking, and batch download operations. The CLI SHALL operate independently of the GUI and SHALL be accessible via the existing `factorio-mod-downloader` command with appropriate flags.

The project uses `uv` for dependency management and PyInstaller for building standalone executables.

## Glossary

- **CLI_System**: The command-line interface component of the Factorio Mod Downloader
- **GUI_System**: The existing graphical user interface component
- **ModDownloader_Core**: The core download engine that handles mod fetching and dependency resolution
- **Config_Manager**: Component responsible for reading and writing configuration files
- **Logger_System**: Structured logging system that outputs to files and console
- **Mod_Registry**: Local database tracking downloaded mods and their versions
- **Batch_Processor**: Component that handles multiple mod downloads from a list
- **Recovery_Manager**: Component that handles partial download resumption and error recovery

## Requirements

### Requirement 1: CLI Interface Foundation

**User Story:** As a developer, I want to use the mod downloader from the command line, so that I can automate mod downloads and integrate them into scripts.

#### Acceptance Criteria

1. WHEN THE user invokes `factorio-mod-downloader --cli`, THE CLI_System SHALL launch in command-line mode without starting the GUI
2. WHEN THE user invokes `factorio-mod-downloader --help`, THE CLI_System SHALL display comprehensive usage information including all available commands and options
3. WHEN THE user invokes `factorio-mod-downloader --version`, THE CLI_System SHALL display the current version number
4. WHEN THE user provides invalid command-line arguments, THE CLI_System SHALL display clear error messages and suggest correct usage
5. THE CLI_System SHALL support both short flags (e.g., `-o`) and long flags (e.g., `--output`) for all options

### Requirement 2: Configuration File Management

**User Story:** As a user, I want to save my download preferences in a configuration file, so that I don't have to specify the same options repeatedly.

#### Acceptance Criteria

1. WHEN THE user invokes `factorio-mod-downloader config init`, THE Config_Manager SHALL create a default configuration file at `~/.factorio-mod-downloader/config.yaml`
2. WHEN THE user invokes `factorio-mod-downloader config set <key> <value>`, THE Config_Manager SHALL update the specified configuration value
3. WHEN THE user invokes `factorio-mod-downloader config get <key>`, THE Config_Manager SHALL display the current value for the specified configuration key
4. WHEN THE user invokes `factorio-mod-downloader config list`, THE Config_Manager SHALL display all current configuration values
5. THE Config_Manager SHALL support configuration values for: default_output_path, include_optional_deps, max_retries, retry_delay, log_level, and concurrent_downloads
6. WHEN THE CLI_System starts a download operation, THE CLI_System SHALL use configuration file values as defaults unless overridden by command-line arguments
7. WHEN THE configuration file does not exist, THE CLI_System SHALL use sensible built-in defaults

### Requirement 3: Structured Logging System

**User Story:** As a user, I want detailed logs of download operations saved to files, so that I can troubleshoot issues and track download history.

#### Acceptance Criteria

1. WHEN THE CLI_System performs any operation, THE Logger_System SHALL write structured log entries to `~/.factorio-mod-downloader/logs/factorio-mod-downloader.log`
2. THE Logger_System SHALL support log levels: DEBUG, INFO, WARNING, ERROR, and CRITICAL
3. WHEN THE user specifies `--log-level <level>`, THE Logger_System SHALL filter console output to the specified level or higher
4. THE Logger_System SHALL include timestamps, log levels, and contextual information in all log entries
5. WHEN THE log file exceeds 10 MB, THE Logger_System SHALL rotate the log file and keep the last 5 log files
6. THE Logger_System SHALL log: download start/completion, dependency resolution, retry attempts, errors, and configuration changes
7. WHEN THE user specifies `--quiet`, THE Logger_System SHALL suppress all console output except errors
8. WHEN THE user specifies `--verbose`, THE Logger_System SHALL display DEBUG level logs to the console

### Requirement 4: Single Mod Download via CLI

**User Story:** As a user, I want to download a single mod with its dependencies from the command line, so that I can quickly fetch mods without opening the GUI.

#### Acceptance Criteria

1. WHEN THE user invokes `factorio-mod-downloader download <mod_url>`, THE CLI_System SHALL download the specified mod and all required dependencies
2. WHEN THE user specifies `--output <path>` or `-o <path>`, THE CLI_System SHALL save downloaded mods to the specified directory
3. WHEN THE user specifies `--include-optional`, THE CLI_System SHALL download optional dependencies in addition to required dependencies
4. THE CLI_System SHALL display real-time progress information including: current mod being analyzed, download progress percentage, download speed, and estimated time remaining
5. WHEN THE download completes successfully, THE CLI_System SHALL exit with status code 0
6. WHEN THE download fails, THE CLI_System SHALL exit with a non-zero status code and log the error
7. THE CLI_System SHALL validate the mod URL format before attempting download

### Requirement 5: Batch Download Operations

**User Story:** As a user, I want to download multiple mods from a list, so that I can set up a complete mod pack in one operation.

#### Acceptance Criteria

1. WHEN THE user invokes `factorio-mod-downloader batch <file_path>`, THE Batch_Processor SHALL read mod URLs from the specified file (one URL per line)
2. THE Batch_Processor SHALL skip empty lines and lines starting with `#` in the batch file
3. WHEN THE Batch_Processor processes a batch file, THE Batch_Processor SHALL download each mod sequentially with dependency resolution
4. THE Batch_Processor SHALL continue processing remaining mods even if one mod download fails
5. WHEN THE batch operation completes, THE CLI_System SHALL display a summary showing: total mods processed, successful downloads, failed downloads, and total download size
6. WHEN THE user specifies `--continue-on-error`, THE Batch_Processor SHALL continue processing even after encountering errors
7. THE Batch_Processor SHALL deduplicate mods across the batch to avoid downloading the same mod multiple times

### Requirement 6: Error Recovery and Resume

**User Story:** As a user, I want to resume interrupted downloads, so that I don't have to restart large downloads from the beginning.

#### Acceptance Criteria

1. WHEN THE CLI_System detects a partial download file (*.part), THE Recovery_Manager SHALL attempt to resume the download from the last completed byte
2. WHEN THE user invokes `factorio-mod-downloader download <mod_url> --resume`, THE Recovery_Manager SHALL check for partial downloads and resume them
3. WHEN THE server does not support range requests, THE Recovery_Manager SHALL restart the download from the beginning and log a warning
4. THE Recovery_Manager SHALL validate partial file integrity before attempting resume
5. WHEN THE user specifies `--max-retries <n>`, THE CLI_System SHALL attempt each failed download up to n times before giving up
6. WHEN THE CLI_System encounters a network error, THE CLI_System SHALL wait for the configured retry_delay before retrying
7. THE Recovery_Manager SHALL clean up partial files after successful download completion

### Requirement 7: Mod Update Checking

**User Story:** As a user, I want to check if my downloaded mods have newer versions available, so that I can keep my mods up to date.

#### Acceptance Criteria

1. WHEN THE user invokes `factorio-mod-downloader check-updates <directory>`, THE CLI_System SHALL scan the specified directory for mod files
2. THE CLI_System SHALL parse mod filenames to extract mod names and current versions
3. THE CLI_System SHALL query the mod portal for the latest available version of each mod
4. WHEN THE CLI_System finds a newer version, THE CLI_System SHALL display the mod name, current version, and latest version
5. WHEN THE user invokes `factorio-mod-downloader update <directory>`, THE CLI_System SHALL download newer versions of all outdated mods
6. WHEN THE user specifies `--update-mod <mod_name>`, THE CLI_System SHALL update only the specified mod
7. THE CLI_System SHALL preserve old mod versions by default unless the user specifies `--replace`
8. THE Mod_Registry SHALL maintain a local database of downloaded mods at `~/.factorio-mod-downloader/mod_registry.json`

### Requirement 8: Progress Reporting and Output Formatting

**User Story:** As a user, I want clear and informative progress updates during downloads, so that I know what the application is doing.

#### Acceptance Criteria

1. WHEN THE CLI_System downloads a file, THE CLI_System SHALL display a progress bar showing percentage complete
2. THE CLI_System SHALL display download speed in MB/s and estimated time remaining
3. WHEN THE CLI_System analyzes dependencies, THE CLI_System SHALL display the current mod being analyzed
4. WHEN THE user specifies `--json`, THE CLI_System SHALL output all information in JSON format for machine parsing
5. THE CLI_System SHALL use colored output for different message types (success=green, error=red, warning=yellow, info=blue) when the terminal supports it
6. WHEN THE CLI_System completes an operation, THE CLI_System SHALL display a summary with total time elapsed and total data downloaded
7. THE CLI_System SHALL detect non-interactive terminals and disable progress bars automatically

### Requirement 9: Dry Run and Validation

**User Story:** As a user, I want to preview what will be downloaded without actually downloading, so that I can verify the operation before committing to it.

#### Acceptance Criteria

1. WHEN THE user specifies `--dry-run`, THE CLI_System SHALL analyze dependencies and display what would be downloaded without performing actual downloads
2. THE CLI_System SHALL display the total number of mods that would be downloaded and estimated total size
3. WHEN THE user invokes `factorio-mod-downloader validate <directory>`, THE CLI_System SHALL verify the integrity of downloaded mod files
4. THE CLI_System SHALL check that mod ZIP files are valid and not corrupted
5. WHEN THE CLI_System finds corrupted files during validation, THE CLI_System SHALL list them and suggest re-downloading

### Requirement 10: Integration with Existing GUI

**User Story:** As a user, I want the CLI and GUI to work seamlessly together, so that I can use whichever interface suits my current needs.

#### Acceptance Criteria

1. THE CLI_System SHALL use the same ModDownloader_Core as the GUI_System for consistency
2. THE CLI_System SHALL read and respect the same configuration values as the GUI_System where applicable
3. WHEN THE user invokes `factorio-mod-downloader` without arguments, THE CLI_System SHALL launch the GUI_System as it currently does
4. THE CLI_System SHALL not require GUI dependencies (customtkinter, PIL) to be loaded when running in CLI mode
5. THE CLI_System SHALL share the same mod registry and download cache with the GUI_System
