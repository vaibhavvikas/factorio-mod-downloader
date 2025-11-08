import os
import random
import socket
import time
from threading import Thread
from typing import Final

import chromedriver_autoinstaller
import requests
from bs4 import BeautifulSoup
from CTkMessagebox import CTkMessagebox
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By


BASE_FACTORIO_MOD_URL: Final = "https://mods.factorio.com/mod"
BASE_MOD_URL: Final = "https://re146.dev/factorio/mods/en#"
BASE_DOWNLOAD_URL: Final = "https://mods-storage.re146.dev"


class ModDownloader(Thread):
    def __init__(self, mod_url, output_path, app):
        super().__init__()
        self.daemon = True
        self.output_path = output_path
        self.mod = mod_url
        self.mod_url = BASE_MOD_URL + mod_url
        self.app = app
        self.downloaded_mods = set()
        self.analyzed_mods = set()

    def run(self):
        try:
            self.chrome_options = self._init_selenium()
            if not self.is_website_up(BASE_MOD_URL):
                raise Exception("Website down.")

            self.log_info(f"Loading mod {self.mod}.\n")
            self.download_mod_with_dependencies(self.mod_url, self.output_path)
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
        except Exception as e:
            CTkMessagebox(
                title="Error",
                width=500,
                wraplength=500,
                message=f"Unknown error occured.\n{str(e).split("\n")[0]}.",
            )
            self.log_info(str(e))
            self.app.progress_file.after(
                0,
                lambda: self.app.progress_file.configure(
                    text="Start download to see progress."
                ),
            )
        finally:
            self.app.download_button.configure(state="normal", text="Start Download")

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

    def _init_selenium(self):
        # Set up chrome options
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

            # Run in headless mode (without a GUI)
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--window-position=-2400,-2400")
            chrome_options.add_argument("--disable-gpu")

            port = 9222
            while port:
                if self.is_port_free(port):
                    chrome_options.add_argument(f"--remote-debugging-port={port}")
                    break
                port += 10

            self.log_info("Configured application dependencies.\n")
            return chrome_options
        except Exception as e:
            self.log_info(str(e))
            raise e

    def init_driver(self):
        driver = webdriver.Chrome(options=self.chrome_options)
        return driver

    def close_driver(self, driver):
        driver.stop_client()
        driver.close()
        driver.quit()

    def download_file(self, url, file_path, file_name):
        entry = self.app.downloader_frame.add_download(file_name)
        entry.label.configure(text=f"Downloading {file_name}")
        entry.progress_bar.set(0)

        def _download():
            try:
                response = requests.get(url, stream=True)
                response.raise_for_status()
                total_size = int(response.headers.get("content-length", 0))
                block_size = max(1024 * 1024 * 10, total_size // 100 or 1)
                progress = 0

                with open(file_path, "wb") as file:
                    for chunk in response.iter_content(chunk_size=block_size):
                        if chunk:
                            file.write(chunk)
                            progress += len(chunk)
                            percentage = progress / total_size if total_size else 0
                            entry.progress_bar.after(0, entry.progress_bar.set, percentage)

                entry.label.after(0, lambda: entry.label.configure(text=f"Downloaded {file_name}"))
                self.log_info(f"Downloaded: {file_path}.\n")
            except Exception as e:
                entry.label.after(0, lambda: entry.label.configure(text=f"Error: {file_name}"))
                self.log_info(f"Error downloading {file_path}: {e}\n")

        # Run download in a new thread to prevent GUI freeze
        Thread(target=_download, daemon=True).start()

    def generate_anticache(self):
        random_number = random.randint(
            1_000_000_000_000_000, 9_999_999_999_999_999
        )  # 16-digit number
        return f"0.{random_number}"

    def get_required_dependencies(self, mod_name):
        # Use mod name to get required dependencies from mod.factorio
        dependency_url = f"https://mods.factorio.com/mod/{mod_name}/dependencies?direction=out&sort=idx&filter=required"
        soup = self.get_page_source(dependency_url, True)
        required_mods = []

        links = soup.find_all("a", class_="mod-dependencies-required")
        if links:
            for a in links:
                dep_name = a.get_text(strip=True)
                mod_url = f"{BASE_MOD_URL}{BASE_FACTORIO_MOD_URL}/{dep_name}"
                required_mods.append((dep_name, mod_url))

        return required_mods

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

    def get_page_source(self, url, is_dependency_check=False):
        driver = self.init_driver()
        print("driver_url:", url)
        driver.get(url)
    
        if is_dependency_check:
            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "table.panel-hole"))
                )
            except Exception:
                print("Timeout: dependency table not found within 15 seconds")
        else:
            time.sleep(2)

        html = driver.page_source
        self.close_driver(driver)
        return BeautifulSoup(html, "html.parser")

    def download_mod_with_dependencies(self, mod_url, download_path):
        self.app.progressbar.stop()
        self.app.progress_file.after(
            0,
            lambda: self.app.progress_file.configure(
                text=f"Analyzing mod {mod_url.split("/")[-1]}"
            ),
        )
        self.app.progressbar.configure(mode="indeterminate")
        self.app.progressbar.start()

        soup = self.get_page_source(mod_url)
        try:
            mod_name = self.get_mod_name(soup)
        except:
            self.log_info(f"Error getting mod name for {mod_url.split("/")[-1]}")
            return
        
        latest_version = self.get_latest_version(soup)
        if mod_name == "" or latest_version == "":
            self.log_info(f"Error getting id from the {mod_url}. Please download it manually. Skipping!\n")
            return
        elif mod_name in ("space-age"):
            self.log_info(f"Skipping reserved dependency {mod_url}. Please download it manually if required.\n")
            return

        self.log_info(f"Loaded mod {mod_name} with version {latest_version}.\n")
        self.analyzed_mods.add(mod_url)
        download_url = f"{BASE_DOWNLOAD_URL}/{mod_name}/{latest_version}.zip?anticache={self.generate_anticache()}"
        file_name = f"{mod_name}_{latest_version}.zip"
        file_path = os.path.join(download_path, file_name)

        # Download the mod file
        os.makedirs(download_path, exist_ok=True)
        if file_name not in self.downloaded_mods:
            self.log_info(f"Downloading {file_name}.\n")
            self.downloaded_mods.add(file_name)
            self.download_file(download_url, file_path, file_name)
        else:
            self.log_info(f"Mod was already downloaded {file_name}. Skipping!\n")

        # Get required dependencies and recursively download them
        self.log_info(f"Loading dependencies for {mod_name}.\n")
        dependencies = self.get_required_dependencies(mod_name)
        if len(dependencies) == 0:
            self.log_info(f"No dependency exists for {mod_name}.\n")
            return

        self.log_info(f"Dependencies found for {mod_name}: {", ".join([dep_name for dep_name, _ in dependencies])}\n")
        for dep_name, dep_url in dependencies:
            if dep_name in self.downloaded_mods or mod_url in self.analyzed_mods:
                continue
            self.log_info(f"Analyzing dependency {dep_name} of {mod_name}\n")
            self.download_mod_with_dependencies(dep_url, download_path)

    def log_info(self, info):
        self.app.textbox.configure(state="normal")
        self.app.textbox.insert("end", info)
        self.app.textbox.yview("end")
        self.app.textbox.configure(state="disabled")
