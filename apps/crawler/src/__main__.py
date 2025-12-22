"""
Main entry point for the crawler when run as a module.

Usage:
    python -m src
"""

import asyncio
from .crawler import main

if __name__ == "__main__":
    asyncio.run(main())
