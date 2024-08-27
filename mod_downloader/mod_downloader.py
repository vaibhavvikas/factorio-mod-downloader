from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
import chromedriver_autoinstaller
from bs4 import BeautifulSoup
import requests
import random
import time
import os
from mod_downloader import utils


class ModDownloader:
    def __init__(self, mod_url: str, output_path: str):
        self.output_path = output_path
        self.mod_url = 'https://re146.dev/factorio/mods/en#' + mod_url
        self.chrome_options = self._init_selenium()

    def start_download(self):
        self.download_mod_with_dependencies(self.mod_url, self.output_path)

    def _init_selenium(self):
        # Set up chrome options
        chromedriver_autoinstaller.install()
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in headless mode (without a GUI)
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--remote-debugging-port=9222")
        return chrome_options

    def init_driver(self):
        driver = webdriver.Chrome(options=self.chrome_options)
        return driver
    
    def close_driver(self, driver):
        driver.quit()

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

        download_url = f"https://mods-storage.re146.dev/{mod_name}/{latest_version}.zip?anticache={utils.generate_anticache()}"
        file_name = f"{mod_name}_{latest_version}.zip"
        file_path = os.path.join(download_path, file_name)
        
        # Download the mod file
        os.makedirs(download_path, exist_ok=True)
        print(f"Downloading {file_name} from {download_url}")
        utils.download_file(download_url, file_path)
        
        # Get required dependencies and recursively download them
        dependencies = self.get_required_dependencies(soup)
        if len(dependencies) == 0:
            return
        
        for _, dep_url in dependencies:
            self.download_mod_with_dependencies(dep_url, download_path)
