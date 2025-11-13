"""Performance testing script for Rust vs Python downloaders."""

import time
import json
import tempfile
import shutil
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np


def test_download_performance():
    """Test and compare download performance."""
    
    # Test URLs (small mods for quick testing)
    test_mods = [
        "https://mods.factorio.com/mod/FNEI",
        "https://mods.factorio.com/mod/even-distribution",
        "https://mods.factorio.com/mod/Side%20Inserters",
    ]
    
    results = {
        "rust": [],
        "python": []
    }
    
    print("=" * 60)
    print("Performance Test: Rust vs Python Downloader")
    print("=" * 60)
    
    # Create temporary directory for downloads
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Test Rust downloader
        print("\n[1/2] Testing Rust Downloader...")
        try:
            from factorio_mod_downloader.core.rust_downloader import RustDownloader, RUST_AVAILABLE
            from factorio_mod_downloader.infrastructure.logger import LoggerSystem
            from factorio_mod_downloader.infrastructure.config import Config
            
            if RUST_AVAILABLE:
                logger = LoggerSystem()
                config = Config()
                rust_dl = RustDownloader(logger, config)
                
                for i, mod_url in enumerate(test_mods, 1):
                    print(f"  [{i}/{len(test_mods)}] Downloading {mod_url.split('/')[-1]}...")
                    
                    start = time.time()
                    result = rust_dl.download_mod(
                        mod_url=mod_url,
                        output_path=str(temp_path / "rust"),
                        factorio_version="2.0",
                        include_optional=False,
                        include_optional_all=False
                    )
                    duration = time.time() - start
                    
                    results["rust"].append({
                        "mod": mod_url.split('/')[-1],
                        "duration": duration,
                        "success": result.success,
                        "mods_count": len(result.downloaded_mods),
                        "size_mb": result.total_size / 1024 / 1024
                    })
                    
                    print(f"    ✓ {duration:.2f}s - {len(result.downloaded_mods)} mods - {result.total_size / 1024 / 1024:.2f} MB")
                
                # Clean up for next test
                shutil.rmtree(temp_path / "rust", ignore_errors=True)
            else:
                print("  ⚠ Rust downloader not available")
        except Exception as e:
            print(f"  ✗ Rust test failed: {e}")
        
        # Test Python downloader
        print("\n[2/2] Testing Python Downloader...")
        try:
            from factorio_mod_downloader.core.downloader import CoreDownloader
            from factorio_mod_downloader.infrastructure.logger import LoggerSystem
            from factorio_mod_downloader.infrastructure.config import Config
            
            logger = LoggerSystem()
            config = Config()
            
            for i, mod_url in enumerate(test_mods, 1):
                print(f"  [{i}/{len(test_mods)}] Downloading {mod_url.split('/')[-1]}...")
                
                python_dl = CoreDownloader(
                    output_path=str(temp_path / "python"),
                    include_optional=False,
                    logger=logger,
                    config=config
                )
                
                start = time.time()
                result = python_dl.download_mod(mod_url)
                duration = time.time() - start
                
                results["python"].append({
                    "mod": mod_url.split('/')[-1],
                    "duration": duration,
                    "success": result.success,
                    "mods_count": len(result.downloaded_mods),
                    "size_mb": result.total_size / 1024 / 1024
                })
                
                print(f"    ✓ {duration:.2f}s - {len(result.downloaded_mods)} mods - {result.total_size / 1024 / 1024:.2f} MB")
            
        except Exception as e:
            print(f"  ✗ Python test failed: {e}")
    
    # Display results
    print("\n" + "=" * 60)
    print("Results Summary")
    print("=" * 60)
    
    if results["rust"] and results["python"]:
        rust_total = sum(r["duration"] for r in results["rust"])
        python_total = sum(r["duration"] for r in results["python"])
        speedup = python_total / rust_total if rust_total > 0 else 0
        
        print(f"\nRust Total Time:   {rust_total:.2f}s")
        print(f"Python Total Time: {python_total:.2f}s")
        print(f"Speedup:           {speedup:.2f}x faster")
        
        # Create visualization
        create_performance_chart(results)
    else:
        print("\n⚠ Incomplete test results")
    
    # Save results to JSON
    with open("performance_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\n✓ Results saved to performance_results.json")


def create_performance_chart(results):
    """Create a bar chart comparing performance."""
    
    if not results["rust"] or not results["python"]:
        print("⚠ Cannot create chart: missing data")
        return
    
    try:
        # Prepare data
        mods = [r["mod"] for r in results["rust"]]
        rust_times = [r["duration"] for r in results["rust"]]
        python_times = [r["duration"] for r in results["python"]]
        
        x = np.arange(len(mods))
        width = 0.35
        
        # Create figure
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        # Chart 1: Individual mod comparison
        bars1 = ax1.bar(x - width/2, rust_times, width, label='Rust', color='#ff6b35')
        bars2 = ax1.bar(x + width/2, python_times, width, label='Python', color='#004e89')
        
        ax1.set_xlabel('Mods')
        ax1.set_ylabel('Time (seconds)')
        ax1.set_title('Download Time Comparison by Mod')
        ax1.set_xticks(x)
        ax1.set_xticklabels(mods, rotation=45, ha='right')
        ax1.legend()
        ax1.grid(axis='y', alpha=0.3)
        
        # Add value labels on bars
        for bars in [bars1, bars2]:
            for bar in bars:
                height = bar.get_height()
                ax1.text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.2f}s',
                        ha='center', va='bottom', fontsize=8)
        
        # Chart 2: Total time comparison
        total_rust = sum(rust_times)
        total_python = sum(python_times)
        speedup = total_python / total_rust if total_rust > 0 else 0
        
        bars = ax2.bar(['Rust', 'Python'], [total_rust, total_python], 
                      color=['#ff6b35', '#004e89'])
        ax2.set_ylabel('Total Time (seconds)')
        ax2.set_title(f'Total Download Time\n(Rust is {speedup:.2f}x faster)')
        ax2.grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.2f}s',
                    ha='center', va='bottom', fontsize=10, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig('performance_comparison.png', dpi=300, bbox_inches='tight')
        print("✓ Performance chart saved to performance_comparison.png")
        
        # Try to display
        try:
            plt.show()
        except:
            pass  # Headless environment
            
    except Exception as e:
        print(f"⚠ Could not create chart: {e}")


if __name__ == "__main__":
    try:
        test_download_performance()
    except KeyboardInterrupt:
        print("\n\n⚠ Test interrupted by user")
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
