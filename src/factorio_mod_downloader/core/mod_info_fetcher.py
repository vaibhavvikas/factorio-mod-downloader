"""Mod information fetching and parsing for Factorio mods."""

import time
from dataclasses import dataclass
from typing import Final, List, Optional, Tuple

import chromedriver_autoinstaller
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from factorio_mod_downloader.downloader.helpers import find_free_port
from factorio_mod_downloader.infrastructure.errors import (
    NetworkError,
    ParsingError
)


# API Constants
BASE_FACTORIO_MOD_URL: Final = "https://mods.factorio.com/mod"
BASE_MOD_URL: Final = "https://re146.dev/factorio/mods/en#"


@dataclass
class ModInfo:
    """Information about a mod."""
    name: str
    version: str
    url: str
    download_url: str
    size: Optional[int] = None
    is_optional: bool = False


class ModInfoFetcher:
    """Fetches and parses mod information from the Factorio mod portal.
    
    This class is independent of GUI callbacks and can be used by both
    CLI and GUI interfaces.
    """
    
    def __init__(self, logger, config):
        """Initialize ModInfoFetcher.
        
        Args:
            logger: LoggerSystem instance for logging
            config: Config object with settings
        """
        self.logger = logger
        self.config = config
        self.chrome_options: Optional[Options] = None
    
    def init_selenium(self) -> Options:
        """Initialize Selenium WebDriver options.
        
        Returns:
            Chrome Options object
            
        Raises:
            Exception: If chromedriver installation fails
        """
        try:
            self.logger.info("Downloading application dependencies (chromedriver)")
            chromedriver_autoinstaller.install()
            self.logger.info("Finished downloading application dependencies")
            
            chrome_options = Options()
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--window-position=-2400,-2400")
            chrome_options.add_argument("--disable-gpu")
            
            # Find and set a free debugging port
            port = find_free_port()
            chrome_options.add_argument(f"--remote-debugging-port={port}")
            
            self.logger.info("Configured application dependencies")
            self.chrome_options = chrome_options
            return chrome_options
            
        except Exception as e:
            self.logger.error(f"Error initializing Selenium: {str(e)}")
            raise
    
    def init_driver(self) -> webdriver.Chrome:
        """Initialize a Chrome WebDriver instance.
        
        Returns:
            Chrome WebDriver instance
        """
        if not self.chrome_options:
            self.init_selenium()
        return webdriver.Chrome(options=self.chrome_options)
    
    def close_driver(self, driver: webdriver.Chrome):
        """Close and cleanup a WebDriver instance.
        
        Args:
            driver: WebDriver instance to close
        """
        try:
            driver.stop_client()
            driver.close()
            driver.quit()
        except Exception as e:
            self.logger.warning(f"Error closing driver: {str(e)}")
    
    def get_page_source(self, url: str, is_dependency_check: bool = False) -> Optional[BeautifulSoup]:
        """Fetch and parse a webpage.
        
        Args:
            url: URL to fetch
            is_dependency_check: Whether to wait for dependency table to load
            
        Returns:
            BeautifulSoup object of the parsed HTML, or None on error
            
        Raises:
            NetworkError: If page cannot be loaded due to network issues
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
            self.logger.error(f"Error loading {url}: {str(e)}")
            # Raise NetworkError for retryable network issues
            raise NetworkError(
                f"Failed to load page: {url}",
                suggestion="Check your internet connection and verify the mod URL is correct"
            )
        finally:
            self.close_driver(driver)
    
    def get_mod_name(self, soup: BeautifulSoup) -> str:
        """Extract mod name from parsed HTML.
        
        Args:
            soup: BeautifulSoup object of mod page
            
        Returns:
            Mod name
            
        Raises:
            ParsingError: If mod name cannot be found
        """
        dd_element = soup.find("dd", id="mod-info-name")
        if not dd_element:
            raise ParsingError(
                "Could not find mod name in page",
                suggestion="The mod page format may have changed or the page failed to load completely"
            )
        return dd_element.get_text(strip=True).strip()
    
    def get_latest_version(self, soup: BeautifulSoup) -> str:
        """Extract the latest mod version from parsed HTML.
        
        Args:
            soup: BeautifulSoup object of mod page
            
        Returns:
            Latest version identifier
            
        Raises:
            ParsingError: If version cannot be found
        """
        select = soup.find("select", {"id": "mod-version"})
        if not select:
            raise ParsingError(
                "No version select element found",
                suggestion="The mod page format may have changed or the page failed to load completely"
            )
        
        # Find the latest version (marked with 'last')
        for option in select.find_all("option"):
            if "(last)" in option.text:
                return option["value"]
        
        # Fallback to first version
        first_option = select.find("option")
        if not first_option:
            raise ParsingError(
                "No version options found",
                suggestion="The mod may not have any published versions"
            )
        
        return first_option["value"]
    
    def get_required_dependencies(
        self, 
        mod_name: str, 
        include_optional: bool = False
    ) -> List[Tuple[str, str]]:
        """Fetch required dependencies for a mod.
        
        Args:
            mod_name: Name of the mod
            include_optional: Whether to include optional dependencies
            
        Returns:
            List of (dependency_name, dependency_url) tuples
        """
        dependency_url = (
            f"{BASE_FACTORIO_MOD_URL}/{mod_name}/dependencies?direction=out&sort=idx&filter=all"
        )
        
        try:
            soup = self.get_page_source(dependency_url, is_dependency_check=True)
            if not soup:
                self.logger.warning(f"Could not fetch dependencies for {mod_name}")
                return []
            
            required_mods = []
            
            # Get required dependencies
            links = soup.find_all("a", class_="mod-dependencies-required")
            for link in links:
                dep_name = link.get_text(strip=True)
                mod_url = f"{BASE_MOD_URL}{BASE_FACTORIO_MOD_URL}/{dep_name}"
                required_mods.append((dep_name, mod_url))
            
            # Get optional dependencies if requested
            if include_optional:
                for link in soup.find_all("a", class_="mod-dependencies-optional"):
                    dep_name = link.get_text(strip=True)
                    mod_url = f"{BASE_MOD_URL}{BASE_FACTORIO_MOD_URL}/{dep_name}"
                    required_mods.append((dep_name, mod_url))
            
            return required_mods
            
        except Exception as e:
            self.logger.error(f"Could not fetch dependencies for {mod_name}: {e}")
            return []
