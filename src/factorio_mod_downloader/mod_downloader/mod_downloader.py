import os
import random
import time
from threading import Thread

import chromedriver_autoinstaller
import requests
from bs4 import BeautifulSoup
from CTkMessagebox import CTkMessagebox
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


class ModDownloader(Thread):
    def __init__(self, mod_url, output_path, app):
        super().__init__()
        self.daemon = True
        self.output_path = output_path
        self.mod_url = 'https://re146.dev/factorio/mods/en#' + mod_url
        self.chrome_options = self._init_selenium()
        self.app = app

    def run(self):
        self.download_mod_with_dependencies(self.mod_url, self.output_path)
        self.log_info("All mods downloaded successfully.\n")
        self.app.download_button.configure(state="normal", text="Start Download")
        CTkMessagebox(title="Download Completed", width=500, wraplength=500, message="Mods successfully downloaded.",
                  icon="check", option_1="Ok")

    def _init_selenium(self):
        # Set up chrome options
        self.log_info("Loading application dependencies.")
        chromedriver_autoinstaller.install()
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in headless mode (without a GUI)
        chrome_options.add_argument("--window-position=-2400,-2400")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--remote-debugging-port=9222")
        return chrome_options

    def init_driver(self):
        driver = webdriver.Chrome(options=self.chrome_options)
        return driver
    
    def close_driver(self, driver):
        driver.quit()

    def download_file(self, url, file_path, file_name):
        self.app.progress_file.after(0, lambda: self.app.progress_file.configure(text=f"Downloading {file_name}"))
        response = requests.get(url, stream=True)
        response.raise_for_status()  # Check if the request was successful

        total_size = int(response.headers.get('content-length', 0))
        
        block_size = max(1024*1024*10, total_size/100)
        progress = 0

        with open(file_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=block_size):
                file.write(chunk)
                progress += len(chunk)
                percentage = (progress / total_size)
                self.app.progressbar.set(percentage)

        self.app.progress_file.after(0, lambda: self.app.progress_file.configure(text=f"Downloaded {file_name}"))
        self.log_info(f"Downloaded: {file_path}.\n")


    def generate_anticache(self):
        random_number = random.randint(1_000_000_000_000_000, 9_999_999_999_999_999)  # 16-digit number
        return f"0.{random_number}"


    def get_required_dependencies(self, soup):
        dependencies = []
        required_deps = soup.find('dd', {'id': 'mod-info-required-dependencies'})
        
        if required_deps:
            links = required_deps.find_all('a', href=True)
            for link in links:
                mod_name = link.text.strip()
                mod_url = link['href']
                dependencies.append((mod_name, mod_url))
        
        return dependencies
    
    
    def get_latest_version(self, soup):
        select = soup.find('select', {'id': 'mod-version'})
        
        if not select:
            raise ValueError("No select element found with id 'mod-version'")
        
        latest_version = None

        for option in select.find_all('option'):
            if '(last)' in option.text:
                latest_version = option['value']
                break
        
        # If no option with '(last)' is found, use the first version
        if not latest_version:
            first_option = select.find('option')
            latest_version = first_option['value']

        return latest_version
    
    def get_mod_name(self, soup):
        dd_element = soup.find('dd', id='mod-info-name')
        mod_name = dd_element.get_text(strip=True)
        return mod_name.strip()

    def download_mod_with_dependencies(self, mod_url, download_path):
        driver = self.init_driver()
        driver.get(mod_url)
        time.sleep(2)
        html = driver.page_source
        self.close_driver(driver)
        soup = BeautifulSoup(html, 'html.parser')
        
        mod_name = self.get_mod_name(soup)
        latest_version = self.get_latest_version(soup)
        self.log_info(f"Loaded mod {mod_name} with version {latest_version}.\n")

        download_url = f"https://mods-storage.re146.dev/{mod_name}/{latest_version}.zip?anticache={self.generate_anticache()}"
        file_name = f"{mod_name}_{latest_version}.zip"
        file_path = os.path.join(download_path, file_name)
        
        # Download the mod file
        os.makedirs(download_path, exist_ok=True)
        self.log_info(f"Downloading {file_name}.\n")
        self.download_file(download_url, file_path, file_name)
        
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
