"""
GeoIP Database Downloader

Downloads MaxMind GeoLite2 databases using their API.
No system tools required - pure Python implementation.
"""

import os
import gzip
import shutil
import tarfile
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error
import structlog

logger = structlog.get_logger()

MAXMIND_BASE_URL = "https://download.maxmind.com/geoip/databases"
EDITIONS = ["GeoLite2-City", "GeoLite2-Country", "GeoLite2-ASN"]


def download_database(
    account_id: str,
    license_key: str,
    edition: str,
    output_dir: str,
) -> Optional[str]:
    """
    Download a MaxMind GeoLite2 database.

    Args:
        account_id: MaxMind account ID
        license_key: MaxMind license key
        edition: Database edition (e.g., 'GeoLite2-City')
        output_dir: Directory to save the database

    Returns:
        Path to the downloaded .mmdb file, or None on failure
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Create the download URL
    url = f"{MAXMIND_BASE_URL}/{edition}/download?suffix=tar.gz"

    # Set up authentication
    password_mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    password_mgr.add_password(None, MAXMIND_BASE_URL, account_id, license_key)
    auth_handler = urllib.request.HTTPBasicAuthHandler(password_mgr)
    opener = urllib.request.build_opener(auth_handler)

    tar_path = output_path / f"{edition}.tar.gz"
    mmdb_path = output_path / f"{edition}.mmdb"

    try:
        logger.info("Downloading GeoIP database", edition=edition)

        # Download the file
        with opener.open(url) as response:
            with open(tar_path, 'wb') as f:
                shutil.copyfileobj(response, f)

        logger.info("Extracting database", edition=edition)

        # Extract the tar.gz
        with tarfile.open(tar_path, 'r:gz') as tar:
            # Find the .mmdb file in the archive
            for member in tar.getmembers():
                if member.name.endswith('.mmdb'):
                    # Extract to a temp location
                    member.name = os.path.basename(member.name)
                    tar.extract(member, output_path)

                    # Rename to standard name
                    extracted_path = output_path / member.name
                    if extracted_path != mmdb_path:
                        if mmdb_path.exists():
                            mmdb_path.unlink()
                        extracted_path.rename(mmdb_path)
                    break

        # Clean up tar file
        tar_path.unlink()

        logger.info("Database downloaded successfully", path=str(mmdb_path))
        return str(mmdb_path)

    except urllib.error.HTTPError as e:
        logger.error("HTTP error downloading database", edition=edition, status=e.code, reason=e.reason)
        if e.code == 401:
            logger.error("Authentication failed - check your account ID and license key")
        return None
    except Exception as e:
        logger.error("Failed to download database", edition=edition, error=str(e))
        return None
    finally:
        # Clean up tar file if it exists
        if tar_path.exists():
            try:
                tar_path.unlink()
            except:
                pass


def download_all_databases(
    account_id: str,
    license_key: str,
    output_dir: str = "./data/geoip",
    editions: list = None,
) -> dict:
    """
    Download all configured GeoLite2 databases.

    Args:
        account_id: MaxMind account ID
        license_key: MaxMind license key
        output_dir: Directory to save databases
        editions: List of editions to download (defaults to all)

    Returns:
        Dict mapping edition names to paths (or None if failed)
    """
    if editions is None:
        editions = EDITIONS

    results = {}
    for edition in editions:
        path = download_database(account_id, license_key, edition, output_dir)
        results[edition] = path

    return results


def ensure_database(
    db_path: str,
    account_id: Optional[str] = None,
    license_key: Optional[str] = None,
) -> bool:
    """
    Ensure the GeoIP database exists, downloading if necessary.

    Args:
        db_path: Expected path to the database
        account_id: MaxMind account ID (or from env MAXMIND_ACCOUNT_ID)
        license_key: MaxMind license key (or from env MAXMIND_LICENSE_KEY)

    Returns:
        True if database exists or was downloaded successfully
    """
    if os.path.exists(db_path):
        logger.info("GeoIP database already exists", path=db_path)
        return True

    # Get credentials from environment if not provided
    account_id = account_id or os.getenv("MAXMIND_ACCOUNT_ID")
    license_key = license_key or os.getenv("MAXMIND_LICENSE_KEY")

    if not account_id or not license_key:
        logger.warning(
            "GeoIP database not found and no MaxMind credentials provided. "
            "Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY environment variables."
        )
        return False

    # Determine edition from path
    path = Path(db_path)
    edition = path.stem  # e.g., "GeoLite2-City" from "GeoLite2-City.mmdb"
    output_dir = str(path.parent)

    result = download_database(account_id, license_key, edition, output_dir)
    return result is not None


if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv

    load_dotenv()

    account_id = os.getenv("MAXMIND_ACCOUNT_ID")
    license_key = os.getenv("MAXMIND_LICENSE_KEY")

    if not account_id or not license_key:
        print("Error: Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY environment variables")
        sys.exit(1)

    output_dir = sys.argv[1] if len(sys.argv) > 1 else "./data/geoip"

    print(f"Downloading GeoLite2 databases to {output_dir}...")
    results = download_all_databases(account_id, license_key, output_dir)

    for edition, path in results.items():
        if path:
            print(f"  ✓ {edition}: {path}")
        else:
            print(f"  ✗ {edition}: FAILED")
