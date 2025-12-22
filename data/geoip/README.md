# GeoIP Data Directory

This directory contains MaxMind GeoLite2 databases for IP geolocation.

## Setup

**The .mmdb database files are NOT included in the repository** (they're 80MB+ and frequently updated).

### Download GeoIP Databases

Run this command to download the databases:

```bash
make geoip
```

This will:
1. Read your MaxMind credentials from `.env`
2. Download the latest GeoLite2 databases
3. Place them in this directory

### Required Files

After running `make geoip`, you should have:

- `GeoLite2-City.mmdb` (61MB) - City-level geolocation
- `GeoLite2-Country.mmdb` (9.3MB) - Country-level geolocation
- `GeoLite2-ASN.mmdb` (11MB) - ASN/ISP data

### MaxMind Account

Get a free account at: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data

Add your credentials to `.env`:
```bash
MAXMIND_ACCOUNT_ID=your_account_id
MAXMIND_LICENSE_KEY=your_license_key
```

### Updates

GeoLite2 databases are updated weekly by MaxMind.

To update:
```bash
make geoip
```

## .gitignore

These files are gitignored:
- `*.mmdb` - Database files (too large, downloadable)
- `GeoIP.conf` - Config with credentials (use GeoIP.conf.example as template)
