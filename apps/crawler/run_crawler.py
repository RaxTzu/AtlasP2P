#!/usr/bin/env python3
"""
Crawler startup script - handles imports correctly
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables from project root .env.local
project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
env_file = os.path.join(project_root, '.env.local')
load_dotenv(env_file)

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Now we can import correctly
import asyncio
from config import load_config
from crawler import EnhancedCrawler

async def main():
    """Run the enhanced crawler."""
    config = load_config()
    crawler = EnhancedCrawler(config)
    await crawler.run()

if __name__ == "__main__":
    asyncio.run(main())
