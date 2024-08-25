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


mod_url = 'https://mods.factorio.com/mod/Krastorio2'


chromedriver_autoinstaller.install()
chrome_options = Options()
chrome_options.add_argument("--headless")  # Run in headless mode (without a GUI)
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--remote-debugging-port=9222")



def get_latest_version(url):
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(url)
    time.sleep(2)  # Adjust sleep time if needed
    html_code = driver.page_source
    driver.quit()
    soup = BeautifulSoup(html_code, 'html.parser')
    
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


def generate_anticache():
    random_number = random.randint(1_000_000_000_000_000, 9_999_999_999_999_999)  # 16-digit number
    return f"0.{random_number}"


def download_file(url, file_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()  # Check if the request was successful

    with open(file_path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=8192):
            file.write(chunk)
    print(f"Downloaded: {file_path}")


def get_required_dependencies(soup):
    dependencies = []
    required_deps = soup.find('dd', {'id': 'mod-info-required-dependencies'})
    
    if required_deps:
        links = required_deps.find_all('a', href=True)
        for link in links:
            mod_name = link.text.strip()
            mod_url = link['href']
            dependencies.append((mod_name, mod_url))
    
    return dependencies


def download_mod_with_dependencies(mod_url, download_path):
    # Get the latest version of the mod
    latest_version = get_latest_version(mod_url)
    mod_name = mod_url.split("/")[-1]
    mod_name = mod_name.strip()

    # Construct the download URL
    download_url = f"https://mods-storage.re146.dev/{mod_name}/{latest_version}.zip?anticache={generate_anticache()}"
    file_name = f"{mod_name}_{latest_version}.zip"
    file_path = os.path.join(download_path, file_name)
    
    # Download the mod file
    os.makedirs(download_path, exist_ok=True)
    print(f"Downloading {file_name} from {download_url}")
    download_file(download_url, file_path)
    
    # Parse the page to check for dependencies
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(mod_url)
    time.sleep(2)
    html = driver.page_source
    driver.quit()
    soup = BeautifulSoup(html, 'html.parser')
    
    # Get required dependencies and recursively download them
    dependencies = get_required_dependencies(soup)
    if len(dependencies) == 0:
        return
    
    for _, dep_url in dependencies:
        download_mod_with_dependencies(dep_url, download_path)


if __name__ == "__main__":
    re146_url = 'https://re146.dev/factorio/mods/en#' + mod_url
    download_mod_with_dependencies(re146_url, "mods")