#!/usr/bin/env python3
"""
Nodes Map Crawler - Entry Point

Simple entry point that automatically sets up the Python path and runs the crawler.
No PYTHONPATH manipulation needed - just run this script!

Usage:
    python run.py              # Run once
    python run.py --continuous # Run continuously (default)
"""

import sys
from pathlib import Path

# Add src/ to Python path so imports work
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Now we can import and run the crawler
if __name__ == "__main__":
    from src.crawler import main
    main()
