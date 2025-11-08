"""
Main downloader module for Factorio mods with dependency resolution.
"""

import os
import time
from threading import Thread
from typing import Final
from typing import List
from typing import Set
from typing import Tuple

import chromedriver_autoinstaller
import requests
from bs4 import BeautifulSoup
from CTkMessagebox import CTkMessagebox
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from factorio_mod_downloader.downloader.helpers import find_free_port
from factorio_mod_downloader.downloader.helpers import generate_anticache
from factorio_mod_downloader.downloader.helpers import is_port_free
from factorio_mod_downloader.downloader.helpers import is_website_up


# API Constants
BASE_FACTORIO_MOD_URL: Final = "https://mods.factorio.com/mod"
BASE_MOD_URL: Final = "https://re146.dev/factorio/mods/en#"
BASE_DOWNLOAD_URL: Final = "https://mods-storage.re146.dev"


class ModDownloader(Thread):
    """Thread-based mod downloader with dependency resolution."""

    def __init__(self, mod_url: str, output_path: str, app):
        """
        Initialize the mod downloader.

        Args:
            mod_url: URL of the mod to download
            output_path: Directory to save downloaded mods
            app: Reference to the GUI application
        """
        super().__init__()
        self.daemon = True
        self.output_path = output_path
        self.mod = mod_url.split("/")[-1]  # Extract mod name from URL
        self.mod_url = BASE_MOD_URL + mod_url
        self.app = app
        self.downloaded_mods: Set[str] = set()
        self.analyzed_mods: Set[str] = set()
        self.chrome_options: Options = None
        self.download_threads = []
        self.include_optional = self.app.optional_deps.get()

    def run(self):
        """Execute the download process."""
        try:
            self.log_info(f"Loading mod {self.mod}.\n")

            if not is_website_up(BASE_MOD_URL):
                raise Exception("Website down. Please check your connection.")

            self.chrome_options = self._init_selenium()
            self.download_mod_with_dependencies(self.mod_url, self.output_path)

            active_threads = [t for t in self.download_threads if t.is_alive()]
            if active_threads:
                self.log_info("Waiting for all downloads to finish...\n")
                self.app.progress_file.after(
                    0, lambda: self.app.progress_file.configure(text="Finalizing downloads...")
                )

                for t in active_threads:
                    t.join()

            self.log_info("All mods downloaded successfully.\n")
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(text="All mods downloaded successfully."),
            )

            CTkMessagebox(
                title="Download Completed",
                width=500,
                wraplength=500,
                message="Mods successfully downloaded.",
                icon="check",
                option_1="Ok",
            )

        except Exception as e:
            self.log_info(f"Error: {str(e).split("\n")[0]}\n")

            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Download failed.\n{error_msg}",
                icon="cancel",
            )

            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(text="Start download to see progress."),
            )

        finally:
            self.app.download_button.configure(state="normal", text="Start Download")
            self.app.path_button.configure(state="normal")

    def _init_selenium(self) -> Options:
        """
        Initialize Selenium WebDriver options.

        Returns:
            Chrome Options object

        Raises:
            Exception: If chromedriver installation fails
        """
        try:
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(
                    text="Downloading and loading dependencies."
                ),
            )

            self.log_info("Downloading application dependencies.\n")
            chromedriver_autoinstaller.install()
            self.log_info("Finished downloading application dependencies.\n")

            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--window-position=-2400,-2400")
            chrome_options.add_argument("--disable-gpu")

            # Find and set a free debugging port
            port = find_free_port()
            chrome_options.add_argument(f"--remote-debugging-port={port}")

            self.log_info("Configured application dependencies.\n")
            return chrome_options

        except Exception as e:
            self.log_info(f"Error initializing Selenium: {str(e).split("\n")[0]}\n")
            raise

    def init_driver(self) -> webdriver.Chrome:
        """
        Initialize a Chrome WebDriver instance.

        Returns:
            Chrome WebDriver instance
        """
        return webdriver.Chrome(options=self.chrome_options)

    def close_driver(self, driver: webdriver.Chrome):
        """
        Close and cleanup a WebDriver instance.

        Args:
            driver: WebDriver instance to close
        """
        try:
            driver.stop_client()
            driver.close()
            driver.quit()
        except Exception as e:
            print(f"Error closing driver: {str(e).split("\n")[0]}")

    def get_page_source(self, url: str, is_dependency_check: bool = False) -> BeautifulSoup:
        """
        Fetch and parse a webpage.

        Args:
            url: URL to fetch
            is_dependency_check: Whether to wait for dependency table to load

        Returns:
            BeautifulSoup object of the parsed HTML

        Raises:
            Exception: If page loading fails
        """
        driver = self.init_driver()

        try:
            driver.get(url)

            if is_dependency_check:
                # Wait for dependency table to load
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "table.panel-hole"))
                )
            else:
                time.sleep(2)

            html = driver.page_source
            return BeautifulSoup(html, "html.parser")
        except Exception as e:
            self.log_info(f"Error loading {url}: {str(e).split("\n")[0]}\n")
            return None
        finally:
            self.close_driver(driver)

    def get_mod_name(self, soup: BeautifulSoup) -> str:
        """
        Extract mod name from parsed HTML.

        Args:
            soup: BeautifulSoup object of mod page

        Returns:
            Mod name

        Raises:
            ValueError: If mod name cannot be found
        """
        dd_element = soup.find("dd", id="mod-info-name")
        if not dd_element:
            raise ValueError("Could not find mod name in page")
        return dd_element.get_text(strip=True).strip()

    def get_latest_version(self, soup: BeautifulSoup) -> str:
        """
        Extract the latest mod version from parsed HTML.

        Args:
            soup: BeautifulSoup object of mod page

        Returns:
            Latest version identifier

        Raises:
            ValueError: If version cannot be found
        """
        select = soup.find("select", {"id": "mod-version"})
        if not select:
            raise ValueError("No version select element found")

        # Find the latest version (marked with 'last')
        for option in select.find_all("option"):
            if "(last)" in option.text:
                return option["value"]

        # Fallback to first version
        first_option = select.find("option")
        if not first_option:
            raise ValueError("No version options found")

        return first_option["value"]

    def get_required_dependencies(self, mod_name: str) -> List[Tuple[str, str]]:
        """
        Fetch required dependencies for a mod.

        Args:
            mod_name: Name of the mod

        Returns:
            List of (dependency_name, dependency_url) tuples
        """
        dependency_url = (
            f"{BASE_FACTORIO_MOD_URL}/{mod_name}/dependencies?direction=out&sort=idx&filter=all"
        )

        try:
            soup = self.get_page_source(dependency_url, is_dependency_check=True)
            if not soup:
                self.log_info(f"Could not fetch dependencies for {mod_name}\n")
                return []

            required_mods = []

            links = soup.find_all("a", class_="mod-dependencies-required")
            for link in links:
                dep_name = link.get_text(strip=True)
                mod_url = f"{BASE_MOD_URL}{BASE_FACTORIO_MOD_URL}/{dep_name}"
                required_mods.append((dep_name, mod_url))

            if self.include_optional:
                for link in soup.find_all("a", class_="mod-dependencies-optional"):
                    dep_name = link.get_text(strip=True)
                    mod_url = f"{BASE_MOD_URL}{BASE_FACTORIO_MOD_URL}/{dep_name}"
                    required_mods.append((dep_name, mod_url))

            return required_mods

        except Exception as e:
            self.log_info(f"Could not fetch dependencies for {mod_name}: {e}\n")
            return []

    def download_file(self, url: str, file_path: str, file_name: str):
        """
        Download a file with progress tracking and retry support.

        Args:
            url: File URL to download
            file_path: Local path to save file
            file_name: Display name for the file
        """
        entry = self.app.downloader_frame.add_download(file_name)
        entry.progress_bar.set(0)

        def _download():
            max_retries = 3
            retry_delay = 2  # seconds

            for attempt in range(1, max_retries + 1):
                try:
                    response = requests.get(url, stream=True, timeout=30)
                    response.raise_for_status()

                    total_size = int(response.headers.get("content-length", 0))
                    min_chunk = 64 * 1024  # 64 KB
                    max_chunk = 4 * 1024 * 1024  # 4 MB
                    block_size = max(min_chunk, min(total_size // 100, max_chunk))
                    progress = 0

                    # Indeterminate progress if no total size
                    if not total_size:
                        entry.progress_bar.after(
                            0, entry.progress_bar.configure, {"mode": "indeterminate"}
                        )

                    with open(file_path, "wb") as file:
                        start_time = time.time()
                        last_update = start_time

                        for chunk in response.iter_content(chunk_size=block_size):
                            if not chunk:
                                continue

                            file.write(chunk)
                            progress += len(chunk)

                            percentage = progress / total_size if total_size else 0
                            now = time.time()

                            # Update UI every ~0.2s for smoother visuals
                            if now - last_update >= 0.2:
                                elapsed = now - start_time
                                speed = (
                                    (progress / 1024 / 1024) / elapsed if elapsed > 0 else 0.0
                                )  # MB/s

                                downloaded_mb = progress / 1024 / 1024
                                total_mb = total_size / 1024 / 1024 if total_size else 0

                                # Thread-safe update using DownloadEntry.update_progress
                                entry.progress_bar.after(
                                    0,
                                    lambda p=percentage, d=downloaded_mb, t=total_mb, s=speed: entry.update_progress(
                                        p, d, t, s
                                    ),
                                )

                                last_update = now

                    # ✅ Mark complete
                    entry.text_label.after(0, entry.mark_complete)
                    self.log_info(f"Downloaded: {file_path.replace("\\", "/")}.\n")
                    break  # success, exit retry loop

                except Exception as e:
                    # Delete partial file
                    if os.path.exists(file_path):
                        os.remove(file_path)

                    if attempt < max_retries:
                        entry.text_label.after(
                            0, lambda x=attempt: entry.mark_retrying(x, max_retries)
                        )
                        self.log_info(
                            f"Error downloading {file_path} (attempt {attempt}): {e}\nRetrying..."
                        )
                        time.sleep(retry_delay)
                    else:
                        entry.text_label.after(0, lambda: entry.mark_failed(str(e)))
                        self.log_info(
                            f"Failed to download {file_path} after {max_retries} attempts: {e}\n"
                        )

        # Run download in background thread to prevent GUI freeze
        t = Thread(target=_download, daemon=True)
        t.start()
        self.download_threads.append(t)

    def download_mod_with_dependencies(self, mod_url: str, download_path: str):
        """
        Recursively download a mod and all its dependencies.

        Args:
            mod_url: URL of the mod to download
            download_path: Directory to save downloads
        """
        # Update UI with current mod being analyzed
        mod_name_display = mod_url.split("/")[-1]
        self.app.progressbar.stop()
        self.app.progress_file.after(
            0,
            lambda: self.app.progress_file.configure(text=f"Analyzing mod {mod_name_display}"),
        )

        self.app.progressbar.configure(mode="indeterminate")
        self.app.progressbar.start()

        try:
            # Fetch mod information
            soup = self.get_page_source(mod_url)
            mod_name = self.get_mod_name(soup)
            latest_version = self.get_latest_version(soup)

            if not mod_name or not latest_version:
                self.log_info(f"Error: Could not get mod info for {mod_url}. Skipping!\n")
                return

            # Skip reserved dependencies
            if mod_name in ("space-age",):
                self.log_info(
                    f"Skipping reserved dependency {mod_name}. Download manually if needed.\n"
                )
                return

            self.log_info(f"Loaded mod {mod_name} with version {latest_version}.\n")
            self.analyzed_mods.add(mod_url)

            # Construct download URL
            download_url = (
                f"{BASE_DOWNLOAD_URL}/{mod_name}/{latest_version}.zip"
                f"?anticache={generate_anticache()}"
            )
            file_name = f"{mod_name}_{latest_version}.zip"
            file_path = os.path.join(download_path, file_name)

            # Download the mod
            os.makedirs(download_path, exist_ok=True)

            if file_name not in self.downloaded_mods:
                self.log_info(f"Downloading {file_name}.\n")
                self.downloaded_mods.add(file_name)
                self.download_file(download_url, file_path, file_name)
            else:
                self.log_info(f"Mod already downloaded {file_name}. Skipping!\n")

            # Fetch and recursively download dependencies
            self.log_info(f"Loading dependencies for {mod_name}.\n")
            dependencies = self.get_required_dependencies(mod_name)

            if not dependencies:
                self.log_info(f"No dependencies found for {mod_name}.\n")
                return

            dep_names = ", ".join([dep_name for dep_name, _ in dependencies])
            self.log_info(f"Dependencies found for {mod_name}: {dep_names}\n")

            for dep_name, dep_url in dependencies:
                if dep_name in self.downloaded_mods or dep_url in self.analyzed_mods:
                    continue

                self.log_info(f"Analyzing dependency {dep_name} of {mod_name}\n")
                self.download_mod_with_dependencies(dep_url, download_path)

        except Exception as e:
            self.log_info(f"Error processing mod: {str(e).split("\n")[0]}\n")

    def log_info(self, info: str):
        """
        Append text to the application's log textbox.

        Args:
            info: Text to log
        """
        self.app.textbox.configure(state="normal")
        self.app.textbox.insert("end", info)
        self.app.textbox.yview("end")
        self.app.textbox.configure(state="disabled")
