#!/bin/bash
set -e

echo "========================================"
echo "Dingocoin Nodes Crawler - Startup"
echo "========================================"

GEOIP_DIR="/app/data/geoip"
GEOIP_CITY="${GEOIP_DIR}/GeoLite2-City.mmdb"
GEOIP_ASN="${GEOIP_DIR}/GeoLite2-ASN.mmdb"
MAX_AGE_DAYS=7

# Function to check if file exists and is not too old
check_geoip_age() {
    local file=$1

    if [ ! -f "$file" ]; then
        echo "❌ GeoIP database missing: $file"
        return 1
    fi

    # Get file age in days
    local file_age_seconds=$(( $(date +%s) - $(stat -c %Y "$file") ))
    local file_age_days=$(( file_age_seconds / 86400 ))

    if [ $file_age_days -gt $MAX_AGE_DAYS ]; then
        echo "⚠️  GeoIP database is $file_age_days days old (max: $MAX_AGE_DAYS days)"
        return 1
    fi

    echo "✅ GeoIP database is fresh ($file_age_days days old)"
    return 0
}

# Check if GeoIP databases exist and are fresh
NEED_DOWNLOAD=0

echo ""
echo "Checking GeoIP databases..."
echo "-------------------------------------------"

if ! check_geoip_age "$GEOIP_CITY"; then
    NEED_DOWNLOAD=1
fi

if ! check_geoip_age "$GEOIP_ASN"; then
    NEED_DOWNLOAD=1
fi

# Download if needed
if [ $NEED_DOWNLOAD -eq 1 ]; then
    echo ""
    echo "Downloading GeoIP databases..."
    echo "-------------------------------------------"

    # Check for credentials
    if [ -z "$MAXMIND_ACCOUNT_ID" ] || [ -z "$MAXMIND_LICENSE_KEY" ]; then
        echo "⚠️  WARNING: MaxMind credentials not set!"
        echo "Set MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY environment variables"
        echo "Get free account at: https://www.maxmind.com/en/geolite2/signup"
        echo ""
        echo "Crawler will continue without GeoIP (limited functionality)"
        echo "-------------------------------------------"
    else
        # Create directory
        mkdir -p "$GEOIP_DIR"

        # Download using Python script
        if python3 -m src.geoip_download "$GEOIP_DIR"; then
            echo "✅ GeoIP databases downloaded successfully"
        else
            echo "❌ GeoIP download failed"
            echo "Crawler will continue without GeoIP (limited functionality)"
        fi
    fi
else
    echo "✅ GeoIP databases are up-to-date"
fi

echo ""
echo "========================================"
echo "Starting Crawler..."
echo "========================================"
echo ""

# Start the crawler
exec python3 -m src.crawler
