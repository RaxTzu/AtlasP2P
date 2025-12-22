"""
GeoIP Lookup Service

Uses MaxMind GeoLite2 database for IP geolocation.
"""

import os
from typing import Dict, Optional
import structlog

try:
    import geoip2.database
    import geoip2.errors
    HAS_GEOIP = True
except ImportError:
    HAS_GEOIP = False

logger = structlog.get_logger()


class GeoIPLookup:
    """GeoIP lookup service using MaxMind databases."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.reader = None
        self.asn_reader = None
        self._cache: Dict[str, Dict] = {}

        if HAS_GEOIP and os.path.exists(db_path):
            try:
                self.reader = geoip2.database.Reader(db_path)
                logger.info("GeoIP City database loaded", path=db_path)
            except Exception as e:
                logger.warning("Failed to load GeoIP database", path=db_path, error=str(e))

            # Try to load ASN database
            asn_db_path = db_path.replace("City", "ASN")
            if os.path.exists(asn_db_path):
                try:
                    self.asn_reader = geoip2.database.Reader(asn_db_path)
                    logger.info("GeoIP ASN database loaded", path=asn_db_path)
                except Exception as e:
                    logger.warning("Failed to load GeoIP ASN database", path=asn_db_path, error=str(e))
        else:
            if not HAS_GEOIP:
                logger.warning("geoip2 library not installed")
            else:
                logger.warning("GeoIP database not found", path=db_path)

    def lookup(self, ip: str) -> Dict:
        """
        Look up geographic information for an IP address.

        Returns a dict with:
        - country_code: ISO country code (e.g., 'US')
        - country_name: Full country name
        - region: State/region name
        - city: City name
        - latitude: Latitude
        - longitude: Longitude
        - timezone: Timezone string
        - isp: ISP name (if available)
        - org: Organization name (if available)
        - asn: Autonomous System Number
        - asn_org: AS organization name
        """
        # Check cache
        if ip in self._cache:
            return self._cache[ip]

        result = {
            "country_code": None,
            "country_name": None,
            "region": None,
            "city": None,
            "latitude": None,
            "longitude": None,
            "timezone": None,
            "isp": None,
            "org": None,
            "asn": None,
            "asn_org": None,
        }

        if not self.reader:
            return result

        try:
            response = self.reader.city(ip)

            result["country_code"] = response.country.iso_code
            result["country_name"] = response.country.name
            result["region"] = (
                response.subdivisions.most_specific.name
                if response.subdivisions
                else None
            )
            result["city"] = response.city.name
            result["latitude"] = response.location.latitude
            result["longitude"] = response.location.longitude
            result["timezone"] = response.location.time_zone

            # Traits (may not be available in all databases)
            if hasattr(response, "traits"):
                result["isp"] = getattr(response.traits, "isp", None)
                result["org"] = getattr(response.traits, "organization", None)

        except geoip2.errors.AddressNotFoundError:
            pass
        except Exception as e:
            logger.debug("GeoIP City lookup failed", ip=ip, error=str(e))

        # Look up ASN information from separate database
        if self.asn_reader:
            try:
                asn_response = self.asn_reader.asn(ip)
                result["asn"] = asn_response.autonomous_system_number
                result["asn_org"] = asn_response.autonomous_system_organization
            except geoip2.errors.AddressNotFoundError:
                pass
            except Exception as e:
                logger.debug("GeoIP ASN lookup failed", ip=ip, error=str(e))

        # Cache result
        self._cache[ip] = result

        # Limit cache size
        if len(self._cache) > 10000:
            # Remove oldest entries
            keys = list(self._cache.keys())[:5000]
            for key in keys:
                del self._cache[key]

        return result

    def close(self):
        """Close the database readers."""
        if self.reader:
            self.reader.close()
            self.reader = None
        if self.asn_reader:
            self.asn_reader.close()
            self.asn_reader = None
