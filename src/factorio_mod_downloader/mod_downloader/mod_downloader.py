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

    def run(self):
        try:
            if self.is_website_down():
                raise WebsiteDownException("https://re146.dev is down. Please close the application and try again later.")
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

    def init_driver(self):
        driver = webdriver.Chrome(options=self.chrome_options)
        return driver

    def close_driver(self, driver):
        driver.stop_client()
        driver.close()
        driver.quit()

    def download_file(self, url, file_path, file_name):
        self.app.progressbar.stop()
        self.app.progressbar.configure(mode="determinate")
        self.app.progress_file.after(
            0, lambda: self.app.progress_file.configure(text=f"Downloading {file_name}")
        )
        self.app.progressbar.set(0)
        response = requests.get(url, stream=True)
        response.raise_for_status()  # Check if the request was successful

        total_size = int(response.headers.get("content-length", 0))

        block_size = max(1024 * 1024 * 10, total_size / 100)
        progress = 0

        with open(file_path, "wb") as file:
            for chunk in response.iter_content(chunk_size=block_size):
                file.write(chunk)
                progress += len(chunk)
                percentage = progress / total_size
                self.app.progressbar.set(percentage)

        self.app.progress_file.after(
            0, lambda: self.app.progress_file.configure(text=f"Downloaded {file_name}")
        )
        self.log_info(f"Downloaded: {file_path}.\n")

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

    def download_mod_with_dependencies(self, mod_url, download_path):
        self.app.progressbar.stop()
        self.app.progress_file.after(
            0,
            lambda: self.app.progress_file.configure(
                text=f"Analayzing mod {mod_url.split("/")[-1]}"
            ),
        )
        self.app.progressbar.configure(mode="indeterminate")
        self.app.progressbar.start()

        driver = self.init_driver()
        driver.get(mod_url)
        time.sleep(2)  # Wait 2 seconds for the page to load successfully.
        html = driver.page_source
        self.close_driver(driver)
        soup = BeautifulSoup(html, "html.parser")

        mod_name = self.get_mod_name(soup)
        latest_version = self.get_latest_version(soup)

        if mod_name == "" or latest_version == "":
            self.log_info(f"Error getting nid from the {mod_url}. Please download it manually. Skipping!\n")

        self.log_info(f"Loaded mod {mod_name} with version {latest_version}.\n")

        download_url = f"{BASE_DOWNLOAD_URL}/{mod_name}/{latest_version}.zip?anticache={self.generate_anticache()}"
        file_name = f"{mod_name}_{latest_version}.zip"
        file_path = os.path.join(download_path, file_name)

        # Download the mod file
        os.makedirs(download_path, exist_ok=True)
        if file_name not in self.downloaded_mods:
            self.log_info(f"Downloading {file_name}.\n")
            self.download_file(download_url, file_path, file_name)
            self.downloaded_mods.add(file_name)
        else:
            self.log_info(f"Mod was already downloaded {file_name}. Skipping!\n")

        # Get required dependencies and recursively download them
        self.log_info(f"Loading dependencies for {mod_name}.\n")
        dependencies = self.get_required_dependencies(soup)
        if len(dependencies) == 0:
            self.log_info(f"No dependency exists for {mod_name}.\n")
            return

        for dep_name, dep_url in dependencies:
            self.log_info(f"Analayzing dependency {dep_name} of {mod_name}\n")
            self.download_mod_with_dependencies(dep_url, download_path)

    def log_info(self, info):
        self.app.textbox.configure(state="normal")
        self.app.textbox.insert("end", info)
        self.app.textbox.yview("end")
        self.app.textbox.configure(state="disabled")
