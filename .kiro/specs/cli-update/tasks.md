# Implementation Plan

- [x] 1. Set up project infrastructure and dependencies





  - Add new dependencies to pyproject.toml (pyyaml, rich, colorama)
  - Run `uv sync` to install new dependencies
  - Create new directory structure (cli/, core/, infrastructure/)
  - Update .gitignore for new config and log directories
  - Verify uv and pyinstaller are available for building
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implement infrastructure layer - Configuration Management




  - [x] 2.1 Create Config data class with default values


    - Define Config dataclass with all configuration fields
    - Implement validation for configuration values
    - _Requirements: 2.5, 2.7_
  
  - [x] 2.2 Implement ConfigManager class


    - Create ConfigManager with load/save functionality
    - Implement YAML file reading and writing
    - Handle missing config file with sensible defaults
    - _Requirements: 2.1, 2.7_
  
  - [x] 2.3 Implement config CLI commands


    - Implement `config init` command
    - Implement `config get <key>` command
    - Implement `config set <key> <value>` command
    - Implement `config list` command
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Implement infrastructure layer - Logging System





  - [x] 3.1 Create LoggerSystem class


    - Set up Python logging with file and console handlers
    - Implement log rotation (10MB max, 5 backups)
    - Configure log formatting with timestamps and levels
    - _Requirements: 3.1, 3.5_
  
  - [x] 3.2 Implement log level filtering


    - Support DEBUG, INFO, WARNING, ERROR, CRITICAL levels
    - Implement --log-level command-line option
    - Implement --quiet and --verbose flags
    - _Requirements: 3.2, 3.3, 3.7, 3.8_
  
  - [x] 3.3 Add logging throughout application


    - Log download operations (start, progress, completion)
    - Log dependency resolution steps
    - Log retry attempts and errors
    - Log configuration changes
    - _Requirements: 3.6_

- [x] 4. Implement infrastructure layer - Mod Registry




  - [x] 4.1 Create ModEntry and ModRegistry classes


    - Define ModEntry dataclass for mod information
    - Implement ModRegistry with JSON persistence
    - _Requirements: 7.8_
  
  - [x] 4.2 Implement registry operations


    - Implement add_mod, get_mod, list_mods methods
    - Implement scan_directory to detect existing mods
    - Parse mod filenames to extract name and version
    - _Requirements: 7.1, 7.2_

- [x] 5. Implement infrastructure layer - Recovery Manager




  - [x] 5.1 Create RecoveryManager class


    - Implement partial file detection (.part files)
    - Implement resume position calculation
    - Implement partial file validation
    - _Requirements: 6.1, 6.4_
  
  - [x] 5.2 Implement recovery operations

    - Implement can_resume check with server support detection
    - Implement create_partial_file and finalize_download
    - Implement cleanup_partial for completed downloads
    - _Requirements: 6.2, 6.3, 6.7_

- [x] 6. Refactor core download engine




  - [x] 6.1 Extract ModInfoFetcher from existing ModDownloader


    - Create ModInfo dataclass
    - Extract get_page_source, get_mod_name, get_latest_version methods
    - Make methods independent of GUI callbacks
    - _Requirements: 4.7, 10.1_
  
  - [x] 6.2 Create DependencyResolver class


    - Extract dependency resolution logic from ModDownloader
    - Implement DependencyTree data structure
    - Implement resolve_dependencies method
    - Implement get_download_list to flatten tree
    - _Requirements: 4.1, 10.1_
  
  - [x] 6.3 Create FileDownloader class


    - Extract file download logic from ModDownloader
    - Add progress callback support (generic, not GUI-specific)
    - Integrate RecoveryManager for resume support
    - Implement retry logic with configurable max_retries
    - _Requirements: 4.1, 6.5, 6.6_
  
  - [x] 6.4 Create CoreDownloader class



    - Implement main download orchestration
    - Use ModInfoFetcher, DependencyResolver, FileDownloader
    - Support progress callbacks for UI updates
    - Return DownloadResult with statistics
    - _Requirements: 4.1, 10.1_
  
  - [x] 6.5 Implement get_download_plan for dry-run


    - Analyze dependencies without downloading
    - Calculate total size and mod count
    - Return DownloadPlan data structure
    - _Requirements: 9.1, 9.2_

- [x] 7. Update GUI to use refactored core











  - [x] 7.1 Modify ModDownloader to use CoreDownloader


    - Replace direct download logic with CoreDownloader calls
    - Adapt progress callbacks to GUI widgets
    - Maintain existing GUI functionality
    - _Requirements: 10.1, 10.2_
  
  - [x] 7.2 Update GUI to use ConfigManager


    - Load configuration on startup
    - Save GUI preferences to config file
    - _Requirements: 10.2, 10.5_
  
  - [ ]* 7.3 Test GUI functionality
    - Verify single mod download works
    - Verify optional dependencies checkbox works
    - Verify progress bars and logs display correctly
    - Verify error handling and retry logic
    - _Requirements: 10.1, 10.3_

- [x] 8. Implement CLI output formatting





  - [x] 8.1 Create OutputFormatter class


    - Implement colored output with colorama
    - Implement print_info, print_success, print_error, print_warning
    - Detect terminal color support
    - Implement --quiet and --verbose handling
    - _Requirements: 8.5, 3.7, 3.8_
  
  - [x] 8.2 Implement progress bar support


    - Create ProgressBar wrapper using rich or tqdm
    - Display percentage, speed, and ETA
    - Detect non-interactive terminals and disable bars
    - _Requirements: 8.1, 8.2, 8.7_
  
  - [x] 8.3 Implement summary and JSON output


    - Implement print_summary for download statistics
    - Implement output_json for machine-readable output
    - Support --json flag
    - _Requirements: 8.4, 8.6_

- [x] 9. Implement CLI argument parsing




  - [x] 9.1 Create argument parser with subcommands


    - Set up argparse with main parser and subparsers
    - Add global options (--help, --version, --log-level, --quiet, --verbose, --json)
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 9.2 Implement download subcommand

    - Add `download <url>` subcommand
    - Add --output/-o, --include-optional, --resume, --max-retries options
    - Add --dry-run flag
    - _Requirements: 4.1, 4.2, 4.3, 6.2, 6.5, 9.1_
  
  - [x] 9.3 Implement batch subcommand

    - Add `batch <file>` subcommand
    - Add --output/-o, --include-optional, --continue-on-error options
    - _Requirements: 5.1, 5.6_
  
  - [x] 9.4 Implement update subcommands

    - Add `check-updates <directory>` subcommand
    - Add `update <directory>` subcommand with --update-mod and --replace options
    - _Requirements: 7.1, 7.5, 7.6, 7.7_
  
  - [x] 9.5 Implement config subcommand

    - Add `config {init,get,set,list}` subcommand
    - Already implemented in task 2.3, just wire to parser
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 9.6 Implement validate subcommand

    - Add `validate <directory>` subcommand
    - _Requirements: 9.3, 9.4, 9.5_
  
  - [x] 9.7 Add input validation


    - Validate mod URLs match expected pattern
    - Validate file paths exist and are accessible
    - Provide clear error messages for invalid inputs
    - _Requirements: 1.4, 4.7_

- [x] 10. Implement CLI application core






  - [x] 10.1 Create CLIApp class

    - Initialize with ConfigManager and LoggerSystem
    - Create OutputFormatter instance
    - Implement main run method that dispatches to subcommands
    - _Requirements: 1.1, 10.4_
  
  - [x] 10.2 Implement download_single command


    - Use CoreDownloader to download mod
    - Display progress with ProgressBar
    - Handle errors and display appropriate messages
    - Return exit code (0 for success, non-zero for failure)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 10.3 Implement download_batch command


    - Read and parse batch file (skip comments and empty lines)
    - Deduplicate mod URLs
    - Download each mod sequentially
    - Continue on error if --continue-on-error specified
    - Display summary with success/failure counts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_
  
  - [x] 10.4 Implement check_updates command


    - Use ModRegistry to scan directory
    - Query mod portal for latest versions
    - Display mods with available updates
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 10.5 Implement update_mods command


    - Check for updates (reuse check_updates logic)
    - Download newer versions
    - Optionally replace old versions or keep both
    - Support updating specific mod with --update-mod
    - _Requirements: 7.5, 7.6, 7.7_
  
  - [x] 10.6 Implement validate command


    - Scan directory for mod files
    - Verify ZIP file integrity
    - Report corrupted files
    - Suggest re-downloading corrupted mods
    - _Requirements: 9.3, 9.4, 9.5_

- [x] 11. Implement entry point routing





  - [x] 11.1 Modify __main__.py to route to CLI or GUI


    - Implement should_use_cli function
    - Route to cli_main if CLI mode detected
    - Route to GUI App if no arguments or --gui flag
    - Ensure GUI dependencies only loaded in GUI mode
    - _Requirements: 1.1, 10.3, 10.4_
  
  - [x] 11.2 Create cli_main entry point



    - Initialize ConfigManager and LoggerSystem
    - Parse command-line arguments
    - Create and run CLIApp
    - Handle top-level exceptions and return exit codes
    - _Requirements: 1.1, 1.5_

- [x] 12. Add comprehensive error handling




  - [x] 12.1 Implement error categories and handling


    - Define error types (Network, Validation, FileSystem, Parsing)
    - Implement retry logic for retryable errors
    - Implement fail-fast for non-retryable errors
    - _Requirements: 6.5, 6.6_
  
  - [x] 12.2 Add user-friendly error messages


    - Provide actionable error messages
    - Include suggestions for common issues
    - Log detailed errors while showing simplified messages to users
    - _Requirements: 1.4, 4.6_

- [x] 13. Documentation and polish





  - [x] 13.1 Update README.md


    - Add CLI usage section with examples
    - Document all commands and options
    - Add configuration file documentation
    - Update development section to reflect uv usage (replace poetry commands)
    - Update build instructions to use `uv run pyinstaller` or appropriate build command `uv build`
    - _Requirements: 1.2_
  
  - [x] 13.2 Add help text and examples


    - Write comprehensive --help text for all commands
    - Add usage examples in help output
    - Build the project with `uv build`
    - _Requirements: 1.2_
  
  - [x] 13.3 Update pyproject.toml


    - Add new dependencies (pyyaml, rich, colorama)
    - Update version number to reflect CLI update
    - Ensure pyinstaller configuration is compatible with uv
    - Add CLI entry point if needed
    - _Requirements: 1.1_

- [ ]* 14. Testing and validation
  - [ ]* 14.1 Write unit tests for core components
    - Test ConfigManager load/save
    - Test DependencyResolver logic
    - Test ModRegistry operations
    - Test RecoveryManager logic
    - _Requirements: All_
  
  - [ ]* 14.2 Write integration tests
    - Test end-to-end single mod download via CLI
    - Test batch download with mixed results
    - Test update checking and updating
    - Test resume functionality
    - _Requirements: All_
  
  - [ ]* 14.3 Manual testing
    - Test CLI in different terminal emulators
    - Test progress bars and colors
    - Test with slow/interrupted network
    - Test large batch downloads
    - Verify GUI still works correctly
    - _Requirements: All_
