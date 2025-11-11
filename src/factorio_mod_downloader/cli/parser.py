"""CLI argument parsing for Factorio Mod Downloader."""

import argparse
import sys
from typing import List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown


# Version information
__version__ = "2.0.0"


def print_simple_help():
    """Print simple beginner-friendly help."""
    console = Console()
    
    console.print("\n[bold cyan]Factorio Mod Downloader v2.0.0[/bold cyan]")
    console.print("[dim]Download Factorio mods with automatic dependency resolution[/dim]\n")
    
    # Quick Start
    console.print(Panel.fit(
        "[bold]Quick Start Guide[/bold]\n\n"
        "1. Download a single mod:\n"
        "   [cyan]fmd download https://mods.factorio.com/mod/Krastorio2[/cyan]\n\n"
        "2. Download multiple mods from JSON file:\n"
        "   [cyan]fmd batch mods.json[/cyan]\n\n"
        "3. Check for mod updates:\n"
        "   [cyan]fmd check-updates ./mods[/cyan]\n\n"
        "4. Initialize configuration:\n"
        "   [cyan]fmd config init[/cyan]",
        title="🚀 Getting Started",
        border_style="green"
    ))
    
    # Available Commands
    console.print("\n[bold yellow]Available Commands:[/bold yellow]")
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column("Command", style="cyan")
    table.add_column("Description")
    
    table.add_row("download", "Download a single mod with dependencies")
    table.add_row("batch", "Download multiple mods from JSON file")
    table.add_row("check-updates", "Check for mod updates")
    table.add_row("update", "Update mods to latest versions")
    table.add_row("config", "Manage configuration")
    table.add_row("validate", "Validate downloaded mod files")
    
    console.print(table)
    
    # More Help
    console.print("\n[bold]Need more help?[/bold]")
    console.print("  • Detailed help: [cyan]fmd -hh[/cyan]")
    console.print("  • Command help: [cyan]fmd <command> --help[/cyan]")
    console.print("  • Version info: [cyan]fmd --version[/cyan]\n")


def print_detailed_help():
    """Print comprehensive detailed help with rich formatting."""
    console = Console()
    
    console.print("\n[bold cyan]╔═══════════════════════════════════════════════════════════════╗[/bold cyan]")
    console.print("[bold cyan]║     Factorio Mod Downloader v2.0.0 - Complete Guide            ║[/bold cyan]")
    console.print("[bold cyan]╚═══════════════════════════════════════════════════════════════╝[/bold cyan]\n")
    
    # Overview
    console.print(Panel(
        "[bold]Factorio Mod Downloader[/bold] is a powerful CLI tool that downloads Factorio mods\n"
        "from the official mod portal with automatic dependency resolution.\n\n"
        "[bold green]✓[/bold green] Automatic dependency resolution\n"
        "[bold green]✓[/bold green] Batch downloads from JSON files\n"
        "[bold green]✓[/bold green] Resume interrupted downloads\n"
        "[bold green]✓[/bold green] Update checking and management\n"
        "[bold green]✓[/bold green] Configuration file support\n"
        "[bold green]✓[/bold green] Rich terminal output with progress bars",
        title="📦 Overview",
        border_style="blue"
    ))
    
    # Commands Section
    console.print("\n[bold yellow]═══ COMMANDS ═══[/bold yellow]\n")
    
    # Download Command
    console.print(Panel.fit(
        "[bold cyan]fmd download <URL> [OPTIONS][/bold cyan]\n\n"
        "[bold]Description:[/bold]\n"
        "Download a single mod and all its required dependencies.\n\n"
        "[bold]Options:[/bold]\n"
        "  -o, --output PATH          Output directory (default: Factorio mods folder)\n"
        "  --include-optional         Include optional dependencies\n"
        "  --dry-run                  Preview what would be downloaded\n"
        "  --max-retries N            Maximum retry attempts (default: 3)\n"
        "  --no-resume                Disable resume functionality\n\n"
        "[bold]Examples:[/bold]\n"
        "  [dim]# Download to Factorio directory[/dim]\n"
        "  fmd download https://mods.factorio.com/mod/Krastorio2\n\n"
        "  [dim]# Download with optional dependencies to custom folder[/dim]\n"
        "  fmd download https://mods.factorio.com/mod/space-exploration \\\n"
        "    --include-optional -o D:\\MyMods\n\n"
        "  [dim]# Preview download without actually downloading[/dim]\n"
        "  fmd download https://mods.factorio.com/mod/FNEI --dry-run",
        title="📥 download",
        border_style="cyan"
    ))
    
    # Batch Command
    console.print("\n")
    console.print(Panel.fit(
        "[bold cyan]fmd batch <JSON_FILE> [OPTIONS][/bold cyan]\n\n"
        "[bold]Description:[/bold]\n"
        "Download multiple mods from a JSON batch file.\n\n"
        "[bold]JSON Format:[/bold]\n"
        '{\n'
        '  "name": "My Modpack",\n'
        '  "mods": [\n'
        '    "https://mods.factorio.com/mod/Krastorio2",\n'
        '    "https://mods.factorio.com/mod/space-exploration"\n'
        '  ]\n'
        '}\n\n'
        "[bold]Options:[/bold]\n"
        "  -o, --output PATH          Output directory\n"
        "  --include-optional         Include optional dependencies\n"
        "  --continue-on-error        Continue if one mod fails\n\n"
        "[bold]Examples:[/bold]\n"
        "  [dim]# Download all mods from JSON file[/dim]\n"
        "  fmd batch mods.json\n\n"
        "  [dim]# Download to custom directory, continue on errors[/dim]\n"
        "  fmd batch mods.json -o ./mods --continue-on-error",
        title="📋 batch",
        border_style="cyan"
    ))
    
    # Check Updates Command
    console.print("\n")
    console.print(Panel.fit(
        "[bold cyan]fmd check-updates <DIRECTORY>[/bold cyan]\n\n"
        "[bold]Description:[/bold]\n"
        "Scan a directory for installed mods and check if newer versions are available.\n\n"
        "[bold]Examples:[/bold]\n"
        "  [dim]# Check for updates in Factorio mods directory[/dim]\n"
        "  fmd check-updates %APPDATA%\\Factorio\\mods\n\n"
        "  [dim]# Check custom directory[/dim]\n"
        "  fmd check-updates ./my-mods",
        title="🔍 check-updates",
        border_style="cyan"
    ))
    
    # Update Command
    console.print("\n")
    console.print(Panel.fit(
        "[bold cyan]fmd update <DIRECTORY> [OPTIONS][/bold cyan]\n\n"
        "[bold]Description:[/bold]\n"
        "Download newer versions of installed mods.\n\n"
        "[bold]Options:[/bold]\n"
        "  --update-mod NAME          Update only specific mod\n"
        "  --replace                  Replace old versions (default: keep both)\n\n"
        "[bold]Examples:[/bold]\n"
        "  [dim]# Update all mods[/dim]\n"
        "  fmd update ./mods\n\n"
        "  [dim]# Update specific mod and replace old version[/dim]\n"
        "  fmd update ./mods --update-mod Krastorio2 --replace",
        title="⬆️  update",
        border_style="cyan"
    ))
    
    # Config Command
    console.print("\n")
    console.print(Panel.fit(
        "[bold cyan]fmd config <ACTION> [ARGS][/bold cyan]\n\n"
        "[bold]Actions:[/bold]\n"
        "  init                       Create default configuration file\n"
        "  list                       Show all configuration values\n"
        "  get <KEY>                  Get specific configuration value\n"
        "  set <KEY> <VALUE>          Set configuration value\n\n"
        "[bold]Configuration Keys:[/bold]\n"
        "  default_output_path        Default download directory\n"
        "  include_optional_deps      Include optional dependencies (true/false)\n"
        "  max_retries                Maximum retry attempts (number)\n"
        "  retry_delay                Delay between retries in seconds\n"
        "  log_level                  Logging level (DEBUG/INFO/WARNING/ERROR)\n"
        "  concurrent_downloads       Number of concurrent downloads\n\n"
        "[bold]Examples:[/bold]\n"
        "  [dim]# Initialize configuration[/dim]\n"
        "  fmd config init\n\n"
        "  [dim]# Set default output path[/dim]\n"
        "  fmd config set default_output_path D:\\MyMods\n\n"
        "  [dim]# View all settings[/dim]\n"
        "  fmd config list",
        title="⚙️  config",
        border_style="cyan"
    ))
    
    # Validate Command
    console.print("\n")
    console.print(Panel.fit(
        "[bold cyan]fmd validate <DIRECTORY>[/bold cyan]\n\n"
        "[bold]Description:[/bold]\n"
        "Check the integrity of downloaded mod files in a directory.\n\n"
        "[bold]Examples:[/bold]\n"
        "  fmd validate ./mods",
        title="✓ validate",
        border_style="cyan"
    ))
    
    # Global Options
    console.print("\n[bold yellow]═══ GLOBAL OPTIONS ═══[/bold yellow]\n")
    console.print(Panel.fit(
        "[bold]--version[/bold]              Show version number\n"
        "[bold]--log-level LEVEL[/bold]      Set logging level (DEBUG/INFO/WARNING/ERROR/CRITICAL)\n"
        "[bold]-q, --quiet[/bold]            Suppress all output except errors\n"
        "[bold]-v, --verbose[/bold]          Enable verbose output (DEBUG level)\n"
        "[bold]--json[/bold]                 Output in JSON format for machine parsing\n"
        "[bold]-h, --help[/bold]             Show simple help message\n"
        "[bold]-hh[/bold]                    Show this detailed help (you are here!)",
        border_style="yellow"
    ))
    
    # Important Notes
    console.print("\n[bold yellow]═══ IMPORTANT NOTES ═══[/bold yellow]\n")
    console.print(Panel(
        "[bold red]⚠[/bold red]  [bold]Default Directory:[/bold]\n"
        "   By default, mods are downloaded to your Factorio installation directory:\n"
        "   • Windows: [cyan]%APPDATA%\\Factorio\\mods[/cyan]\n"
        "   • Linux: [cyan]~/.factorio/mods[/cyan]\n\n"
        "   If Factorio is not installed or hasn't been run at least once, you MUST\n"
        "   specify a custom output directory with [cyan]-o/--output[/cyan].\n\n"
        "[bold green]✓[/bold green]  [bold]Batch Files:[/bold]\n"
        "   Batch files must be in JSON format with a [cyan].json[/cyan] extension.\n"
        "   See example-mods.json in the repository for reference.\n\n"
        "[bold blue]ℹ[/bold blue]  [bold]Configuration:[/bold]\n"
        "   Configuration is stored at: [cyan]~/.fmd/config.yaml[/cyan]\n"
        "   Logs are stored at: [cyan]~/.fmd/logs/[/cyan]",
        border_style="yellow"
    ))
    
    # Footer
    console.print("\n[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]")
    console.print("[dim]For more information, visit: https://github.com/vaibhavvikas/fmd[/dim]")
    console.print("[bold cyan]═══════════════════════════════════════════════════════════════[/bold cyan]\n")


def check_for_detailed_help(args: List[str]) -> bool:
    """Check if -hh flag is present and show detailed help.
    
    Args:
        args: Command-line arguments.
        
    Returns:
        True if detailed help was shown, False otherwise.
    """
    if '-hh' in args:
        print_detailed_help()
        return True
    return False


def create_parser() -> argparse.ArgumentParser:
    """Create the main argument parser with all subcommands.
    
    Returns:
        Configured ArgumentParser instance.
    """
    # Main parser with custom help
    parser = argparse.ArgumentParser(
        prog='fmd',
        description='Download Factorio mods from the mod portal with dependency resolution.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,  # We'll handle help ourselves
        epilog="""
This is the normal help command. More detailed help is available with -hh

Quick Examples:
  fmd download https://mods.factorio.com/mod/Krastorio2
  fmd batch mods.json
  fmd check-updates ./mods
  fmd config init

For detailed help with all commands and options:
  fmd -hh
        """
    )
    
    # Add custom help argument
    parser.add_argument(
        '-h', '--help',
        action='store_true',
        help='Show this help message'
    )
    
    # Global options
    parser.add_argument(
        '--version',
        action='version',
        version=f'%(prog)s {__version__}'
    )
    
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default=None,
        help='Set logging level (default: INFO)'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress all output except errors'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output (DEBUG level)'
    )
    
    parser.add_argument(
        '--json',
        action='store_true',
        dest='json_output',
        help='Output in JSON format for machine parsing'
    )
    
    # Create subparsers
    subparsers = parser.add_subparsers(
        dest='command',
        help='Available commands',
        required=False
    )
    
    # Download subcommand
    _add_download_subcommand(subparsers)
    
    # Batch subcommand
    _add_batch_subcommand(subparsers)
    
    # Check-updates subcommand
    _add_check_updates_subcommand(subparsers)
    
    # Update subcommand
    _add_update_subcommand(subparsers)
    
    # Config subcommand
    _add_config_subcommand(subparsers)
    
    # Validate subcommand
    _add_validate_subcommand(subparsers)
    
    return parser


def _add_download_subcommand(subparsers):
    """Add download subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    download_parser = subparsers.add_parser(
        'download',
        help='Download a single mod with dependencies',
        description="""Download a Factorio mod and its dependencies from the mod portal.
        
This command will:
  1. Analyze the mod and resolve all required dependencies
  2. Download the mod and all dependencies recursively
  3. Display progress with download speed and ETA
  4. Resume interrupted downloads automatically (unless --no-resume)
  5. Retry failed downloads up to max-retries times

The mod URL should be in the format: https://mods.factorio.com/mod/<mod-name>
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    download_parser.add_argument(
        'url',
        help='URL of the mod to download (e.g., https://mods.factorio.com/mod/Krastorio2)'
    )
    
    download_parser.add_argument(
        '--output', '-o',
        dest='output_path',
        default=None,
        help='Output directory for downloaded mods (default: from config or ./mods)'
    )
    
    download_parser.add_argument(
        '--include-optional',
        action='store_true',
        help='Include optional dependencies in download'
    )
    
    download_parser.add_argument(
        '--resume',
        action='store_true',
        default=True,
        help='Resume interrupted downloads (default: enabled)'
    )
    
    download_parser.add_argument(
        '--no-resume',
        action='store_false',
        dest='resume',
        help='Disable resume functionality'
    )
    
    download_parser.add_argument(
        '--max-retries',
        type=int,
        default=None,
        help='Maximum number of retry attempts for failed downloads (default: from config or 3)'
    )
    
    download_parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be downloaded without actually downloading'
    )


def _add_batch_subcommand(subparsers):
    """Add batch subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    batch_parser = subparsers.add_parser(
        'batch',
        help='Download multiple mods from a JSON file',
        description="""Download multiple Factorio mods from a JSON batch file.

Batch file format (JSON):
  - Must be a valid JSON file with .json extension
  - Contains a 'mods' array with mod URLs
  - Duplicate mods are automatically deduplicated

Example batch file (mods.json):
  {
    "name": "My Factorio Modpack",
    "description": "Collection of essential mods",
    "mods": [
      "https://mods.factorio.com/mod/Krastorio2",
      "https://mods.factorio.com/mod/space-exploration",
      "https://mods.factorio.com/mod/FNEI",
      "https://mods.factorio.com/mod/even-distribution"
    ]
  }

Alternative format (direct array):
  [
    "https://mods.factorio.com/mod/Krastorio2",
    "https://mods.factorio.com/mod/space-exploration"
  ]
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    batch_parser.add_argument(
        'file',
        help='Path to JSON batch file containing mod URLs'
    )
    
    batch_parser.add_argument(
        '--output', '-o',
        dest='output_path',
        default=None,
        help='Output directory for downloaded mods (default: from config or ./mods)'
    )
    
    batch_parser.add_argument(
        '--include-optional',
        action='store_true',
        help='Include optional dependencies in download'
    )
    
    batch_parser.add_argument(
        '--continue-on-error',
        action='store_true',
        help='Continue processing remaining mods even if one fails'
    )


def _add_check_updates_subcommand(subparsers):
    """Add check-updates subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    check_updates_parser = subparsers.add_parser(
        'check-updates',
        help='Check for mod updates in a directory',
        description='Scan a directory for installed mods and check if newer versions are available.'
    )
    
    check_updates_parser.add_argument(
        'directory',
        help='Directory containing mod files to check'
    )


def _add_update_subcommand(subparsers):
    """Add update subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    update_parser = subparsers.add_parser(
        'update',
        help='Update mods to latest versions',
        description='Download newer versions of installed mods.'
    )
    
    update_parser.add_argument(
        'directory',
        help='Directory containing mod files to update'
    )
    
    update_parser.add_argument(
        '--update-mod',
        dest='mod_name',
        default=None,
        help='Update only the specified mod by name'
    )
    
    update_parser.add_argument(
        '--replace',
        action='store_true',
        help='Replace old versions (default: keep both old and new)'
    )


def _add_config_subcommand(subparsers):
    """Add config subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    config_parser = subparsers.add_parser(
        'config',
        help='Manage configuration',
        description="""Initialize, view, or modify configuration settings.

Configuration is stored at: ~/.fmd/config.yaml

Available configuration keys:
  - default_output_path: Default directory for downloads (default: ./mods)
  - include_optional_deps: Include optional dependencies (default: false)
  - max_retries: Maximum retry attempts (default: 3)
  - retry_delay: Delay between retries in seconds (default: 2)
  - log_level: Logging level (default: INFO)
  - concurrent_downloads: Number of concurrent downloads (default: 3)

Examples:
  fmd config init
  fmd config set default_output_path ./my-mods
  fmd config get max_retries
  fmd config list
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    config_subparsers = config_parser.add_subparsers(
        dest='config_action',
        help='Configuration actions',
        required=True
    )
    
    # config init
    config_subparsers.add_parser(
        'init',
        help='Initialize default configuration file'
    )
    
    # config get
    config_get_parser = config_subparsers.add_parser(
        'get',
        help='Get a configuration value'
    )
    config_get_parser.add_argument(
        'key',
        help='Configuration key to retrieve'
    )
    
    # config set
    config_set_parser = config_subparsers.add_parser(
        'set',
        help='Set a configuration value'
    )
    config_set_parser.add_argument(
        'key',
        help='Configuration key to set'
    )
    config_set_parser.add_argument(
        'value',
        help='Value to set'
    )
    
    # config list
    config_subparsers.add_parser(
        'list',
        help='List all configuration values'
    )


def _add_validate_subcommand(subparsers):
    """Add validate subcommand to parser.
    
    Args:
        subparsers: Subparsers object to add command to.
    """
    validate_parser = subparsers.add_parser(
        'validate',
        help='Validate downloaded mod files',
        description='Check the integrity of downloaded mod files in a directory.'
    )
    
    validate_parser.add_argument(
        'directory',
        help='Directory containing mod files to validate'
    )


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments.
    
    Args:
        args: List of arguments to parse. If None, uses sys.argv[1:].
        
    Returns:
        Parsed arguments namespace.
    """
    # If no arguments provided, use sys.argv
    if args is None:
        args = sys.argv[1:]
    
    # Check for detailed help first
    if check_for_detailed_help(args):
        sys.exit(0)
    
    parser = create_parser()
    
    # If no arguments provided, show simple help
    if len(args) == 0:
        print_simple_help()
        sys.exit(0)
    
    # Parse arguments
    parsed = parser.parse_args(args)
    
    # Handle custom help flag
    if hasattr(parsed, 'help') and parsed.help:
        print_simple_help()
        sys.exit(0)
    
    return parsed
