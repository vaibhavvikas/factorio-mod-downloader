import asyncio
import os
import random
import time
from threading import Thread
from typing import Final
import sys
import subprocess

import aiohttp
import requests
from bs4 import BeautifulSoup
from CTkMessagebox import CTkMessagebox
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


BASE_MOD_URL: Final = "https://re146.dev/factorio/mods/en#"
BASE_DOWNLOAD_URL: Final = "https://mods-storage.re146.dev"


class WebsiteDownException(Exception):
    def __init__(self, message):
        super().__init__(message)


class ModDownloader(Thread):
    def __init__(self, mod_url, output_path, app):
        super().__init__()
        self.daemon = True
        self.output_path = output_path
        self.mod = mod_url
        self.mod_url = BASE_MOD_URL + mod_url
        self.app = app
        self.downloaded_mods = set()
        # Playwright objects
        self._pw = None
        self._browser = None
        self._context = None
        # Semaphore for controlling concurrent operations
        self._semaphore = None
        self._max_concurrent = 10
        # Progress tracking
        self._total_mods_found = 0
        self._total_mods_downloaded = 0
        self._currently_downloading = {}  # filename -> progress (0.0 to 1.0)
        self._lock = asyncio.Lock()
        self._progress_mode = "indeterminate"  # Track current mode to avoid unnecessary switches

    def run(self):
        # Run async code from thread
        try:
            if self.is_website_down():
                raise WebsiteDownException("https://re146.dev is down. Please close the application and try again later.")
            self.chrome_options = self._init_selenium()
            if not self.is_website_up(BASE_MOD_URL):
                raise Exception("Website down.")

            self.log_info(f"Loading mod {self.mod}.\n")
            await self.download_mod_with_dependencies(self.mod_url, self.output_path)
            self.log_info("All mods downloaded successfully.\n")
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(
                    text="All mods downloaded successfully."
                ),
            )
            CTkMessagebox(
                title="Download Completed",
                width=500,
                wraplength=500,
                message="Mods successfully downloaded.",
                icon="check",
                option_1="Ok",
            )
        finally:
            await self._shutdown_playwright()

    def is_website_up(self, url, timeout=5):
        try:
            response = requests.get(url, timeout=timeout)
            if response.status_code == 200:
                return True
            else:
                print(f"Website responded with status code: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.log_info(f"Error connecting to {url}, Website might be down or check your internet connection.")
            return False
    
    def is_port_free(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            result = sock.connect_ex(("localhost", port))
            return result != 0

    def is_website_down(self):
        try:
            response = requests.get(BASE_MOD_URL, timeout=5)
            if response.status_code >= 200 and response.status_code < 300:
                return False
            else:
                return True
        except requests.exceptions.RequestException:
            return True

    def _init_selenium(self):
        # Set up chrome options
        try:
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(
                    text="Downloading and loading dependencies."
                ),
            )

            self.log_info("Retrieving Chromium drivers.\n")
            chromedriver_autoinstaller.install()
            self.log_info("Chromium drivers successfully retrieved.\n")
            chrome_options = Options()

            # Run in headless mode (without a GUI)
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--window-position=-2400,-2400")
            chrome_options.add_argument("--disable-gpu")

            port = 9222
            while port:
                if self.is_port_free(port):
                    chrome_options.add_argument(f"--remote-debugging-port={port}")
                    break
                port += 1
            return chrome_options
        except Exception as e:
            self.log_info(str(e))
            raise e

    async def _install_playwright_browsers(self, browser: str = "chromium"):
        """Install Playwright browsers programmatically. Runs synchronously in a worker thread.
        - In frozen (PyInstaller) builds, call playwright.__main__.main and swallow SystemExit(0).
        - In non-frozen runs, prefer invoking `python -m playwright install`.
        """
        def install_sync():
            # Frozen app path: avoid spawning the frozen exe with -m; use in-process CLI instead
            if getattr(sys, "frozen", False):
                try:
                    from playwright.__main__ import main as pw_main
                except Exception as e:
                    raise RuntimeError(
                        "Playwright is not available in the frozen application."
                    ) from e

                saved_argv = sys.argv[:]
                try:
                    sys.argv = ["playwright", "install", browser]
                    try:
                        pw_main()
                    except SystemExit as se:
                        # Treat SystemExit(0) as success; non-zero as failure
                        code = se.code if isinstance(se.code, int) else 0
                        if code not in (0, None):
                            raise RuntimeError(
                                f"Playwright install exited with code {code}"
                            ) from se
                finally:
                    sys.argv = saved_argv
                return

            # Non-frozen: use subprocess to run the module
            try:
                subprocess.run(
                    [sys.executable, "-m", "playwright", "install", browser],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
            except subprocess.CalledProcessError as e:
                raise RuntimeError(
                    f"Failed to install Playwright browser '{browser}'. Output: {e.stdout}"
                ) from e
            except Exception as e:
                raise RuntimeError(
                    f"Failed to install Playwright browser '{browser}'. Error: {e}"
                ) from e

        # Run the blocking install in a background thread to avoid freezing the event loop
        await asyncio.to_thread(install_sync)

    async def _shutdown_playwright(self):
        try:
            if self._context:
                await self._context.close()
        except Exception:
            pass
        try:
            if self._browser:
                await self._browser.close()
        except Exception:
            pass
        try:
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass

    async def _get_page_html(self, url: str) -> str:
        # Create a new page for this request to allow concurrent fetching
        page = await self._context.new_page()
        try:
            # Force full page reload by navigating with reload option
            # This ensures the SPA processes the hash properly
            await page.goto(url, wait_until="load", timeout=45000)
            
            # Force a reload to ensure content updates
            await page.reload(wait_until="load", timeout=30000)
            
            # Wait for network activity to settle
            try:
                await page.wait_for_load_state("networkidle", timeout=15000)
            except PlaywrightTimeoutError:
                pass
            
            # Wait for the mod-specific content to appear
            try:
                await page.wait_for_selector("#mod-version", timeout=10000, state="visible")
            except PlaywrightTimeoutError:
                # Fallback: wait a bit more for dynamic content
                await page.wait_for_timeout(3000)
            
            return await page.content()
        finally:
            await page.close()

    def _update_progress_display(self):
        """Update the progress text and bar to show concurrent downloads"""
        # Update overall status
        status_text = f"Total: {self._total_mods_downloaded}/{self._total_mods_found} mods completed"
        self.app.progress_overall.after(
            0, lambda: self.app.progress_overall.configure(text=status_text)
        )
        
        # Update currently downloading list
        if self._currently_downloading:
            download_names = list(self._currently_downloading.keys())[:2]  # Show first 2
            download_list = ", ".join(download_names)
            if len(self._currently_downloading) > 2:
                download_list += f" +{len(self._currently_downloading) - 2} more"
            current_text = f"Downloading: {download_list}"
        else:
            current_text = "Currently downloading: None"
        
        self.app.progress_file.after(
            0, lambda: self.app.progress_file.configure(text=current_text)
        )
        
        # Calculate overall progress (combined progress of all active downloads + completed)
        if self._total_mods_found > 0:
            # Sum of completed mods + partial progress of currently downloading mods
            active_progress = sum(self._currently_downloading.values())
            total_progress = (self._total_mods_downloaded + active_progress) / self._total_mods_found
            total_progress = min(1.0, max(0.0, total_progress))  # Clamp between 0 and 1
            
            # Only switch to determinate mode once, never switch back
            if self._progress_mode != "determinate":
                self._progress_mode = "determinate"
                def switch_mode():
                    self.app.progressbar.stop()  # Stop indeterminate animation
                    self.app.progressbar.configure(mode="determinate")
                    self.app.progressbar.set(total_progress)
                self.app.progressbar.after_idle(switch_mode)
            else:
                # Just update the value
                self.app.progressbar.after_idle(lambda p=total_progress: self.app.progressbar.set(p))

    async def download_file(self, url, file_path, file_name):
        # Add to currently downloading dict with 0 progress
        async with self._lock:
            self._currently_downloading[file_name] = 0.0
            self._update_progress_display()
        
        try:
            # Use aiohttp for async downloads
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    
                    total_size = int(response.headers.get("content-length", 0))
                    block_size = max(1024 * 1024 * 10, total_size / 100) if total_size > 0 else 1024 * 1024
                    progress = 0
                    
                    with open(file_path, "wb") as file:
                        async for chunk in response.content.iter_chunked(int(block_size)):
                            file.write(chunk)
                            progress += len(chunk)
                            if total_size > 0:
                                percentage = progress / total_size
                                # Update this file's progress in the dict
                                async with self._lock:
                                    self._currently_downloading[file_name] = percentage
                                    self._update_progress_display()

            self.log_info(f"Downloaded: {file_path}.\n")
        finally:
            # Atomically remove from downloading and increment completed count
            async with self._lock:
                # Set progress to 1.0 before removal to ensure smooth transition
                self._currently_downloading[file_name] = 1.0
                self._currently_downloading.pop(file_name, None)
                self._total_mods_downloaded += 1
                self._update_progress_display()

    def generate_anticache(self):
        random_number = random.randint(
            1_000_000_000_000_000, 9_999_999_999_999_999
        )  # 16-digit number
        return f"0.{random_number}"

    def get_required_dependencies(self, soup):
        dependencies = []
        required_deps = soup.find("dd", {"id": "mod-info-required-dependencies"})

        if required_deps:
            links = required_deps.find_all("a", href=True)
            for link in links:
                mod_name = link.text.strip()
                mod_url = link["href"]
                dependencies.append((mod_name, mod_url))

        return dependencies

    def get_latest_version(self, soup):
        select = soup.find("select", {"id": "mod-version"})

        if not select:
            raise ValueError("No select element found with id 'mod-version'")

        latest_version = None

        for option in select.find_all("option"):
            if "(last)" in option.text:
                latest_version = option["value"]
                break

        # If no option with '(last)' is found, use the first version
        if not latest_version:
            first_option = select.find("option")
            latest_version = first_option["value"]

        return latest_version

    def get_mod_name(self, soup):
        dd_element = soup.find("dd", id="mod-info-name")
        mod_name = dd_element.get_text(strip=True)
        return mod_name.strip()

    async def download_mod_with_dependencies(self, mod_url, download_path):
        async with self._semaphore:  # Limit concurrent operations
            html = await self._get_page_html(mod_url)
            soup = BeautifulSoup(html, "html.parser")

            mod_name = self.get_mod_name(soup)
            latest_version = self.get_latest_version(soup)

            if mod_name == "" or latest_version == "":
                self.log_info(f"Error getting nid from the {mod_url}. Please download it manually. Skipping!\n")
                return

            # Increment total found counter
            async with self._lock:
                self._total_mods_found += 1
                self._update_progress_display()

            self.log_info(f"Loaded mod {mod_name} with version {latest_version}.\n")

            download_url = f"{BASE_DOWNLOAD_URL}/{mod_name}/{latest_version}.zip?anticache={self.generate_anticache()}"
            file_name = f"{mod_name}_{latest_version}.zip"
            file_path = os.path.join(download_path, file_name)

            # Download the mod file
            os.makedirs(download_path, exist_ok=True)
            if file_name not in self.downloaded_mods:
                self.log_info(f"Downloading {file_name}.\n")
                await self.download_file(download_url, file_path, file_name)
                self.downloaded_mods.add(file_name)
            else:
                self.log_info(f"Mod was already downloaded {file_name}. Skipping!\n")
                async with self._lock:
                    self._total_mods_downloaded += 1
                    self._update_progress_display()

            # Get required dependencies and recursively download them
            self.log_info(f"Loading dependencies for {mod_name}.\n")
            dependencies = self.get_required_dependencies(soup)
            
            if len(dependencies) == 0:
                self.log_info(f"No dependency exists for {mod_name}.\n")
                return

            # Download dependencies concurrently
            tasks = []
            for dep_name, dep_url in dependencies:
                self.log_info(f"Analayzing dependency {dep_name} of {mod_name}\n")
                tasks.append(self.download_mod_with_dependencies(dep_url, download_path))
            
            # Wait for all dependencies to complete
            await asyncio.gather(*tasks, return_exceptions=True)

    def log_info(self, info):
        self.app.textbox.configure(state="normal")
        self.app.textbox.insert("end", info)
        self.app.textbox.yview("end")
        self.app.textbox.configure(state="disabled")
