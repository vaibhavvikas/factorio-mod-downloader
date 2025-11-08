"""
Downloader helper functions and utilities.
"""

import random
import socket
import time
from typing import Optional

import requests
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def is_website_up(url: str, timeout: int = 5) -> bool:
    """
    Check if a website is accessible.

    Args:
        url: Website URL to check
        timeout: Request timeout in seconds

    Returns:
        True if website is accessible, False otherwise
    """
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return True
        else:
            print(f"Website responded with status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"Error connecting to {url}: {e}")
        return False


def is_port_free(port: int) -> bool:
    """
    Check if a port is available.

    Args:
        port: Port number to check

    Returns:
        True if port is free, False otherwise
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        result = sock.connect_ex(("localhost", port))
        return result != 0


def find_free_port(start_port: int = 9222, step: int = 10) -> int:
    """
    Find the first available port starting from start_port.

    Args:
        start_port: Starting port number
        step: Increment step between attempts

    Returns:
        First available port number
    """
    port = start_port
    while port:
        if is_port_free(port):
            return port
        port += step
    return start_port


def generate_anticache() -> str:
    """
    Generate a random anti-cache parameter.

    Returns:
        16-digit random number as string with '0.' prefix
    """
    random_number = random.randint(1_000_000_000_000_000, 9_999_999_999_999_999)
    return f"0.{random_number}"


def wait_for_element(driver, by, value, timeout: int = 15) -> bool:
    """
    Wait for an element to be present on the page.

    Args:
        driver: Selenium WebDriver instance
        by: Locator strategy (e.g., By.CSS_SELECTOR)
        value: Locator value
        timeout: Maximum wait time in seconds

    Returns:
        True if element found, False on timeout
    """
    try:
        WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))
        return True
    except Exception:
        return False
