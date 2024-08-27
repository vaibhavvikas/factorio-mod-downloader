import requests
import random

def download_file(url, file_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()  # Check if the request was successful

    with open(file_path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=8192):
            file.write(chunk)

    print(f"Downloaded: {file_path}")


def generate_anticache():
    random_number = random.randint(1_000_000_000_000_000, 9_999_999_999_999_999)  # 16-digit number
    return f"0.{random_number}"
