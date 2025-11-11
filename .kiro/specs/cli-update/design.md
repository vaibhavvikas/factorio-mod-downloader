# Design Document: CLI Update

## Overview

The CLI Update feature adds a comprehensive command-line interface to the Factorio Mod Downloader while maintaining full compatibility with the existing GUI. The design follows a modular architecture that extracts the core download logic into reusable components, adds new CLI-specific modules for argument parsing and output formatting, and implements supporting infrastructure for configuration management, logging, error recovery, and mod tracking.

The key design principle is **separation of concerns**: the core download engine is decoupled from both GUI and CLI presentation layers, allowing both interfaces to share the same underlying functionality while providing interface-appropriate user experiences.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Entry Point Layer                        │
│  (__main__.py - Routes to GUI or CLI based on arguments)    │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐   ┌──────▼──────┐
│  GUI Layer   │   │  CLI Layer  │
│  (existing)  │   │    (new)    │
└───────┬──────┘   └──────┬──────┘
        │                 │
        └────────┬────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                    Core Layer (refactored)                   │
│  • ModDownloader (decoupled from GUI)                       │
│  • DependencyResolver                                        │
│  • FileDownloader                                            │
│  • ModInfoFetcher                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  Infrastructure Layer (new)                  │
│  • ConfigManager                                             │
│  • LoggerSystem                                              │
│  • ModRegistry                                               │
│  • RecoveryManager                                           │
└──────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/factorio_mod_downloader/
├── __init__.py
├── __main__.py                    # Modified: Route to GUI or CLI
├── cli/                           # NEW: CLI-specific code
│   ├── __init__.py
│   ├── app.py                     # CLI application entry point
│   ├── commands.py                # Command implementations
│   ├── parser.py                  # Argument parsing
│   ├── output.py                  # Progress bars, formatting
│   └── validators.py              # Input validation
├── core/                          # NEW: Refactored core logic
│   ├── __init__.py
│   ├── downloader.py              # Core download engine (GUI-agnostic)
│   ├── dependency_resolver.py    # Dependency resolution logic
│   ├── file_downloader.py         # File download with progress
│   └── mod_info_fetcher.py        # Mod information scraping
├── infrastructure/                # NEW: Supporting services
│   ├── __init__.py
│   ├── config.py                  # Configuration management
│   ├── logger.py                  # Logging system
│   ├── registry.py                # Mod registry/database
│   └── recovery.py                # Error recovery and resume
├── gui/                           # Existing GUI code
│   ├── __init__.py
│   ├── app.py                     # Modified: Use core layer
│   ├── frames.py                  # Modified: Use core layer
│   └── utils.py
└── downloader/                    # Existing (to be refactored)
    ├── __init__.py
    ├── mod_downloader.py          # Will be split into core/
    └── helpers.py                 # Will move to infrastructure/
```

## Components and Interfaces

### 1. Entry Point Modification (`__main__.py`)

**Purpose:** Route execution to GUI or CLI based on command-line arguments.

**Interface:**
```python
def main():
    """Main entry point that routes to GUI or CLI."""
    args = sys.argv[1:]
    
    # Check if CLI mode is requested
    if should_use_cli(args):
        from factorio_mod_downloader.cli.app import cli_main
        sys.exit(cli_main(args))
    else:
        # Launch GUI (existing behavior)
        from factorio_mod_downloader.gui.app import App
        app = App()
        app.mainloop()

def should_use_cli(args: List[str]) -> bool:
    """Determine if CLI mode should be used based on arguments."""
    # CLI mode if any arguments provided or --cli flag
    return len(args) > 0 or '--cli' in args
```

### 2. CLI Application (`cli/app.py`)

**Purpose:** Main CLI application coordinator.

**Interface:**
```python
class CLIApp:
    """Main CLI application."""
    
    def __init__(self, config: Config, logger: Logger):
        self.config = config
        self.logger = logger
        self.output = OutputFormatter(config)
    
    def run(self, args: argparse.Namespace) -> int:
        """Execute CLI command and return exit code."""
        
    def download_single(self, mod_url: str, output_path: str, 
                       include_optional: bool) -> int:
        """Download a single mod with dependencies."""
        
    def download_batch(self, batch_file: str, output_path: str) -> int:
        """Download multiple mods from a file."""
        
    def check_updates(self, directory: str) -> int:
        """Check for mod updates in a directory."""
        
    def update_mods(self, directory: str, mod_name: Optional[str],
                   replace: bool) -> int:
        """Update mods to latest versions."""
```

### 3. Argument Parser (`cli/parser.py`)

**Purpose:** Parse and validate command-line arguments.

**Interface:**
```python
def create_parser() -> argparse.ArgumentParser:
    """Create the main argument parser with all subcommands."""
    
def parse_args(args: List[str]) -> argparse.Namespace:
    """Parse command-line arguments."""
    
# Subcommands:
# - download <url>: Download a single mod
# - batch <file>: Download from batch file
# - check-updates <dir>: Check for updates
# - update <dir>: Update mods
# - config {init,get,set,list}: Manage configuration
# - validate <dir>: Validate downloaded mods
```

### 4. Output Formatter (`cli/output.py`)

**Purpose:** Handle progress display, formatting, and colored output.

**Interface:**
```python
class OutputFormatter:
    """Handles CLI output formatting and progress display."""
    
    def __init__(self, config: Config):
        self.quiet = config.quiet
        self.verbose = config.verbose
        self.json_output = config.json_output
        self.use_colors = self._detect_color_support()
    
    def print_info(self, message: str):
        """Print informational message."""
        
    def print_success(self, message: str):
        """Print success message in green."""
        
    def print_error(self, message: str):
        """Print error message in red."""
        
    def print_warning(self, message: str):
        """Print warning message in yellow."""
    
    def create_progress_bar(self, total: int, desc: str) -> ProgressBar:
        """Create a progress bar for downloads."""
        
    def print_summary(self, stats: DownloadStats):
        """Print download summary."""
        
    def output_json(self, data: dict):
        """Output data in JSON format."""

class ProgressBar:
    """CLI progress bar wrapper (using tqdm or rich)."""
    
    def update(self, n: int):
        """Update progress by n units."""
        
    def set_postfix(self, **kwargs):
        """Set progress bar postfix (speed, ETA, etc.)."""
        
    def close(self):
        """Close and finalize progress bar."""
```

### 5. Core Download Engine (`core/downloader.py`)

**Purpose:** GUI-agnostic download orchestration (refactored from existing `ModDownloader`).

**Interface:**
```python
class CoreDownloader:
    """Core download engine independent of UI."""
    
    def __init__(self, 
                 output_path: str,
                 include_optional: bool,
                 logger: Logger,
                 config: Config,
                 progress_callback: Optional[Callable] = None):
        self.output_path = output_path
        self.include_optional = include_optional
        self.logger = logger
        self.config = config
        self.progress_callback = progress_callback
        self.dependency_resolver = DependencyResolver(logger, config)
        self.file_downloader = FileDownloader(logger, config)
        self.mod_info_fetcher = ModInfoFetcher(logger, config)
    
    def download_mod(self, mod_url: str) -> DownloadResult:
        """Download a mod and its dependencies."""
        
    def get_download_plan(self, mod_url: str) -> DownloadPlan:
        """Get download plan without downloading (for dry-run)."""

class DownloadResult:
    """Result of a download operation."""
    success: bool
    downloaded_mods: List[str]
    failed_mods: List[Tuple[str, str]]  # (mod_name, error)
    total_size: int
    duration: float
```

### 6. Dependency Resolver (`core/dependency_resolver.py`)

**Purpose:** Resolve mod dependencies recursively.

**Interface:**
```python
class DependencyResolver:
    """Resolves mod dependencies."""
    
    def __init__(self, logger: Logger, config: Config):
        self.logger = logger
        self.config = config
        self.mod_info_fetcher = ModInfoFetcher(logger, config)
    
    def resolve_dependencies(self, 
                           mod_url: str,
                           include_optional: bool) -> DependencyTree:
        """Resolve all dependencies for a mod."""
        
    def get_download_list(self, tree: DependencyTree) -> List[ModInfo]:
        """Flatten dependency tree into download list."""

class DependencyTree:
    """Tree structure representing mod dependencies."""
    root: ModInfo
    dependencies: List['DependencyTree']
    
class ModInfo:
    """Information about a mod."""
    name: str
    version: str
    url: str
    download_url: str
    size: Optional[int]
    is_optional: bool
```

### 7. File Downloader (`core/file_downloader.py`)

**Purpose:** Handle actual file downloads with progress tracking and retry logic.

**Interface:**
```python
class FileDownloader:
    """Handles file downloads with progress and retry."""
    
    def __init__(self, logger: Logger, config: Config):
        self.logger = logger
        self.config = config
        self.recovery_manager = RecoveryManager(logger, config)
    
    def download_file(self,
                     url: str,
                     output_path: str,
                     progress_callback: Optional[Callable] = None,
                     resume: bool = True) -> DownloadFileResult:
        """Download a file with progress tracking and retry."""
        
    def _download_with_retry(self, 
                            url: str,
                            output_path: str,
                            max_retries: int) -> bool:
        """Download with automatic retry on failure."""

class DownloadFileResult:
    """Result of a single file download."""
    success: bool
    file_path: str
    size: int
    duration: float
    error: Optional[str]
```

### 8. Configuration Manager (`infrastructure/config.py`)

**Purpose:** Manage application configuration from file and command-line.

**Interface:**
```python
class ConfigManager:
    """Manages application configuration."""
    
    DEFAULT_CONFIG_PATH = Path.home() / '.factorio-mod-downloader' / 'config.yaml'
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or self.DEFAULT_CONFIG_PATH
        self.config = self._load_config()
    
    def _load_config(self) -> Config:
        """Load configuration from file or create default."""
        
    def save_config(self):
        """Save current configuration to file."""
        
    def get(self, key: str) -> Any:
        """Get configuration value."""
        
    def set(self, key: str, value: Any):
        """Set configuration value."""
        
    def init_config(self):
        """Initialize default configuration file."""

class Config:
    """Configuration data class."""
    default_output_path: str = './mods'
    include_optional_deps: bool = False
    max_retries: int = 3
    retry_delay: int = 2
    log_level: str = 'INFO'
    concurrent_downloads: int = 3
    quiet: bool = False
    verbose: bool = False
    json_output: bool = False
```

**Configuration File Format (YAML):**
```yaml
# Factorio Mod Downloader Configuration
default_output_path: ./mods
include_optional_deps: false
max_retries: 3
retry_delay: 2
log_level: INFO
concurrent_downloads: 3
```

### 9. Logger System (`infrastructure/logger.py`)

**Purpose:** Structured logging to file and console with rotation.

**Interface:**
```python
class LoggerSystem:
    """Structured logging system."""
    
    LOG_DIR = Path.home() / '.factorio-mod-downloader' / 'logs'
    LOG_FILE = 'factorio-mod-downloader.log'
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    BACKUP_COUNT = 5
    
    def __init__(self, log_level: str = 'INFO', console_level: Optional[str] = None):
        self.logger = self._setup_logger(log_level, console_level)
    
    def _setup_logger(self, log_level: str, console_level: Optional[str]) -> logging.Logger:
        """Set up logger with file and console handlers."""
        
    def debug(self, message: str, **kwargs):
        """Log debug message."""
        
    def info(self, message: str, **kwargs):
        """Log info message."""
        
    def warning(self, message: str, **kwargs):
        """Log warning message."""
        
    def error(self, message: str, **kwargs):
        """Log error message."""
        
    def critical(self, message: str, **kwargs):
        """Log critical message."""
```

### 10. Mod Registry (`infrastructure/registry.py`)

**Purpose:** Track downloaded mods and their versions.

**Interface:**
```python
class ModRegistry:
    """Registry of downloaded mods."""
    
    REGISTRY_PATH = Path.home() / '.factorio-mod-downloader' / 'mod_registry.json'
    
    def __init__(self):
        self.registry = self._load_registry()
    
    def _load_registry(self) -> Dict[str, ModEntry]:
        """Load registry from file."""
        
    def save_registry(self):
        """Save registry to file."""
        
    def add_mod(self, mod_name: str, version: str, file_path: str):
        """Add or update a mod in the registry."""
        
    def get_mod(self, mod_name: str) -> Optional[ModEntry]:
        """Get mod information from registry."""
        
    def list_mods(self) -> List[ModEntry]:
        """List all registered mods."""
        
    def scan_directory(self, directory: Path) -> List[ModEntry]:
        """Scan directory for mod files and update registry."""

class ModEntry:
    """Registry entry for a mod."""
    name: str
    version: str
    file_path: str
    download_date: datetime
    size: int
```

### 11. Recovery Manager (`infrastructure/recovery.py`)

**Purpose:** Handle partial download resumption and error recovery.

**Interface:**
```python
class RecoveryManager:
    """Manages download recovery and resumption."""
    
    def __init__(self, logger: Logger, config: Config):
        self.logger = logger
        self.config = config
    
    def can_resume(self, file_path: str, url: str) -> bool:
        """Check if a download can be resumed."""
        
    def get_resume_position(self, file_path: str) -> int:
        """Get byte position to resume from."""
        
    def create_partial_file(self, file_path: str) -> str:
        """Create .part file for partial download."""
        
    def finalize_download(self, partial_path: str, final_path: str):
        """Move partial file to final location."""
        
    def cleanup_partial(self, file_path: str):
        """Clean up partial download files."""
        
    def validate_partial(self, file_path: str) -> bool:
        """Validate partial file integrity."""
```

## Data Models

### Download Statistics
```python
@dataclass
class DownloadStats:
    """Statistics for a download operation."""
    total_mods: int
    successful: int
    failed: int
    skipped: int
    total_size: int  # bytes
    duration: float  # seconds
    average_speed: float  # MB/s
```

### Batch File Format
```
# Factorio Mod Batch Download List
# Lines starting with # are comments
# One mod URL per line

https://mods.factorio.com/mod/Krastorio2
https://mods.factorio.com/mod/space-exploration
https://mods.factorio.com/mod/alien-biomes

# Optional mods
https://mods.factorio.com/mod/FNEI
```

## Error Handling

### Error Categories

1. **Network Errors**: Connection failures, timeouts
   - Strategy: Retry with exponential backoff
   - Max retries: Configurable (default 3)

2. **Validation Errors**: Invalid URLs, malformed batch files
   - Strategy: Fail fast with clear error message
   - No retry

3. **File System Errors**: Permission denied, disk full
   - Strategy: Fail with actionable error message
   - No retry

4. **Parsing Errors**: Cannot extract mod info from HTML
   - Strategy: Log error, skip mod, continue with others
   - Retry once after delay

### Error Recovery Flow

```
Download Attempt
    ↓
[Success?] → Yes → Complete
    ↓ No
[Retryable?] → No → Fail
    ↓ Yes
[Attempts < Max?] → No → Fail
    ↓ Yes
Wait (retry_delay)
    ↓
Download Attempt (loop)
```

## Testing Strategy

### Unit Tests
- Configuration loading/saving
- Argument parsing
- Dependency resolution logic
- File download with mocked network
- Registry operations
- Recovery manager logic

### Integration Tests
- End-to-end single mod download
- Batch download with mixed success/failure
- Configuration file integration
- Logging output verification
- Resume interrupted download

### Manual Testing
- CLI usability and help text
- Progress bar display in various terminals
- Color output in different terminal emulators
- Large batch downloads
- Network interruption recovery

## Performance Considerations

1. **Concurrent Downloads**: Support downloading multiple files simultaneously (configurable, default 3)
2. **Dependency Caching**: Cache dependency resolution results to avoid redundant scraping
3. **Lazy Loading**: Only import GUI dependencies when GUI mode is used
4. **Streaming Downloads**: Use streaming for large files to minimize memory usage
5. **Progress Update Throttling**: Update progress bars at most every 200ms to reduce overhead

## Security Considerations

1. **URL Validation**: Validate all mod URLs match expected pattern before processing
2. **Path Traversal**: Sanitize file paths to prevent directory traversal attacks
3. **File Permissions**: Set appropriate permissions on config and log files (0600)
4. **HTTPS Only**: Enforce HTTPS for all network requests
5. **Input Sanitization**: Sanitize all user inputs before logging or displaying

## Migration Strategy

### Phase 1: Core Refactoring
1. Extract core download logic from GUI-coupled `ModDownloader`
2. Create `core/` module with GUI-agnostic components
3. Update GUI to use new core components
4. Ensure GUI functionality remains unchanged

### Phase 2: Infrastructure
1. Implement configuration management
2. Implement logging system
3. Implement mod registry
4. Implement recovery manager

### Phase 3: CLI Implementation
1. Implement CLI argument parser
2. Implement output formatter
3. Implement CLI commands (download, batch)
4. Integrate with core and infrastructure

### Phase 4: Advanced Features
1. Implement update checking
2. Implement validation
3. Implement dry-run mode
4. Add JSON output support

## Dependencies

### New Dependencies
- `pyyaml`: Configuration file parsing
- `rich` or `tqdm`: Progress bars and formatted output
- `colorama`: Cross-platform colored terminal output (Windows support)

### Existing Dependencies (no changes)
- `requests`: HTTP requests
- `beautifulsoup4`: HTML parsing
- `selenium`: Web scraping
- `chromedriver-autoinstaller`: ChromeDriver management

### Build and Development Tools
- `uv`: Dependency management and package installation (replaces poetry)
- `pyinstaller`: Building standalone executables for distribution
- The project uses `uv sync` to install dependencies and `uv run` to execute commands

## Backward Compatibility

- Existing GUI functionality remains unchanged
- Running `factorio-mod-downloader` without arguments launches GUI as before
- Configuration file is optional; CLI works with defaults if not present
- Mod registry is optional; CLI works without it (just won't track history)
