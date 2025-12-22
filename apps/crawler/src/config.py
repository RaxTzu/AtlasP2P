"""
Crawler Configuration

Loads configuration from config/project.config.yaml and environment variables.
This provides a single source of truth for fork customization.
"""

import os
import yaml
from dataclasses import dataclass
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

# Load .env from project root (searches up the directory tree)
load_dotenv(find_dotenv('.env', usecwd=True))


@dataclass
class ChainConfig:
    """Chain-specific configuration."""
    name: str
    ticker: str
    p2p_port: int
    rpc_port: int
    protocol_version: int
    magic_bytes: bytes
    dns_seeds: List[str]
    seed_nodes: List[str]  # Direct IP:port seeds for guaranteed discovery
    current_version: str
    minimum_version: str
    user_agent_pattern: str


def load_chain_config_from_yaml() -> ChainConfig:
    """
    Load chain configuration from config/project.config.yaml

    This replaces the hardcoded CHAINS dict with YAML-based config
    for easy fork customization.
    """
    # Try multiple possible paths to find the YAML config
    possible_paths = [
        Path.cwd() / "config" / "project.config.yaml",
        Path.cwd() / ".." / ".." / "config" / "project.config.yaml",
        Path(__file__).parent.parent.parent.parent / "config" / "project.config.yaml",
    ]

    config_path = None
    for path in possible_paths:
        if path.exists():
            config_path = path
            break

    if not config_path:
        raise FileNotFoundError(
            "Could not find config/project.config.yaml. "
            "Please ensure it exists in the project root."
        )

    with open(config_path, 'r') as f:
        project_config = yaml.safe_load(f)

    chain_config_data = project_config.get('chainConfig', {})

    # Validate required fields - fail fast if not configured
    required_fields = ['name', 'magicBytes', 'p2pPort', 'protocolVersion']
    missing = [f for f in required_fields if f not in chain_config_data]
    if missing:
        raise ValueError(
            f"Missing required chainConfig fields in project.config.yaml: {missing}. "
            "Please configure all chain-specific values."
        )

    # Parse magic bytes from config (hex string like "c1c1c1c1")
    magic_bytes_hex = chain_config_data.get('magicBytes')
    try:
        magic_bytes = bytes.fromhex(magic_bytes_hex)
        if len(magic_bytes) != 4:
            raise ValueError("magicBytes must be exactly 4 bytes (8 hex chars)")
    except (ValueError, TypeError) as e:
        raise ValueError(
            f"Invalid magicBytes in project.config.yaml: {magic_bytes_hex}. "
            f"Must be 8 hex characters (e.g., 'f9beb4d9' for Bitcoin). Error: {e}"
        )

    # Parse user agent patterns from config (REQUIRED for proper version parsing)
    user_agent_patterns = chain_config_data.get('userAgentPatterns', [])
    if user_agent_patterns:
        user_agent_pattern = user_agent_patterns[0]
    else:
        # Generic fallback - will match but won't extract version properly
        # Users should configure userAgentPatterns for their chain
        chain_name = chain_config_data.get('name', 'Unknown')
        user_agent_pattern = rf"/({chain_name}):([0-9.]+)/"

    # Parse DNS seeds from chainConfig (at least one seed source required)
    dns_seeds = chain_config_data.get('dnsSeeds', [])
    seed_nodes = chain_config_data.get('seedNodes', [])

    if not dns_seeds and not seed_nodes:
        raise ValueError(
            "No seed sources configured in project.config.yaml. "
            "Please provide at least one of: dnsSeeds or seedNodes"
        )

    return ChainConfig(
        name=chain_config_data.get('name'),
        ticker=chain_config_data.get('ticker', chain_config_data.get('name', 'UNKNOWN')[:5].upper()),
        p2p_port=chain_config_data.get('p2pPort'),
        rpc_port=chain_config_data.get('rpcPort', chain_config_data.get('p2pPort')),
        protocol_version=chain_config_data.get('protocolVersion'),
        magic_bytes=magic_bytes,
        dns_seeds=dns_seeds,
        seed_nodes=seed_nodes,
        current_version=chain_config_data.get('currentVersion', '0.0.0'),
        minimum_version=chain_config_data.get('minimumVersion', '0.0.0'),
        user_agent_pattern=user_agent_pattern,
    )


@dataclass
class CrawlerConfig:
    """Crawler configuration from environment."""
    chain: str
    chain_config: ChainConfig

    # Supabase
    supabase_url: str
    supabase_key: str

    # RPC (optional, for additional node data)
    rpc_host: Optional[str]
    rpc_port: Optional[int]
    rpc_user: Optional[str]
    rpc_pass: Optional[str]

    # GeoIP
    geoip_db_path: str

    # Crawler settings
    interval_minutes: int
    max_concurrent: int
    connection_timeout: int
    extended_timeout: int  # For "reachable" nodes on retry
    getaddr_delay_ms: int
    prune_after_hours: int
    max_retries: int
    initial_retry_delay: float
    retry_backoff_multiplier: float
    fallback_protocol_versions: List[int]
    require_version_for_save: bool

    # Alerts (optional)
    alerts_enabled: bool
    web_app_url: Optional[str]
    alerts_api_key: Optional[str]


def load_crawler_config_from_yaml() -> dict:
    """
    Load crawler configuration from config/project.config.yaml

    Returns defaults if crawlerConfig section is missing.
    """
    # Try multiple possible paths to find the YAML config
    possible_paths = [
        Path.cwd() / "config" / "project.config.yaml",
        Path.cwd() / ".." / ".." / "config" / "project.config.yaml",
        Path(__file__).parent.parent.parent.parent / "config" / "project.config.yaml",
    ]

    config_path = None
    for path in possible_paths:
        if path.exists():
            config_path = path
            break

    if not config_path:
        # Return defaults if YAML not found
        return {
            'pruneAfterHours': 168,
            'scanIntervalMinutes': 5,
            'maxConcurrentConnections': 100,
            'connectionTimeoutSeconds': 10,
            'extendedTimeoutSeconds': 30,
            'maxRetries': 3,
            'initialRetryDelaySeconds': 1,
            'retryBackoffMultiplier': 2,
            'fallbackProtocolVersions': [],
            'requireVersionForSave': True,
        }

    with open(config_path, 'r') as f:
        project_config = yaml.safe_load(f)

    return project_config.get('crawlerConfig', {})


def load_config() -> CrawlerConfig:
    """
    Load configuration from config/project.config.yaml and environment variables.

    Priority: Environment variables > YAML config > defaults
    This allows YAML to be the single source of truth while still
    supporting env var overrides for deployment flexibility.
    """
    # Load chain config from YAML
    chain_config = load_chain_config_from_yaml()
    chain = os.getenv("CHAIN", chain_config.name.lower())

    # Load crawler settings from YAML
    crawler_yaml = load_crawler_config_from_yaml()

    # Resolve GeoIP path: if relative, resolve from project root
    geoip_path = os.getenv("GEOIP_DB_PATH", "./data/geoip/GeoLite2-City.mmdb")

    # If path is a directory, append the database filename
    if os.path.isdir(geoip_path):
        geoip_path = os.path.join(geoip_path, "GeoLite2-City.mmdb")

    if not os.path.isabs(geoip_path):
        # Find project root (where .env lives)
        project_root = Path(find_dotenv('.env', usecwd=True)).parent if find_dotenv('.env', usecwd=True) else Path.cwd()
        geoip_path = str(project_root / geoip_path)

    # YAML values with environment variable overrides
    prune_after_hours = int(os.getenv(
        "PRUNE_AFTER_HOURS",
        str(crawler_yaml.get('pruneAfterHours', 168))
    ))
    interval_minutes = int(os.getenv(
        "CRAWLER_INTERVAL_MINUTES",
        str(crawler_yaml.get('scanIntervalMinutes', 5))
    ))
    max_concurrent = int(os.getenv(
        "MAX_CONCURRENT_CONNECTIONS",
        str(crawler_yaml.get('maxConcurrentConnections', 100))
    ))
    connection_timeout = int(os.getenv(
        "CONNECTION_TIMEOUT_SECONDS",
        str(crawler_yaml.get('connectionTimeoutSeconds', 10))
    ))
    extended_timeout = int(os.getenv(
        "EXTENDED_TIMEOUT_SECONDS",
        str(crawler_yaml.get('extendedTimeoutSeconds', 30))
    ))
    max_retries = int(os.getenv(
        "MAX_RETRIES",
        str(crawler_yaml.get('maxRetries', 3))
    ))
    initial_retry_delay = float(os.getenv(
        "INITIAL_RETRY_DELAY_SECONDS",
        str(crawler_yaml.get('initialRetryDelaySeconds', 1))
    ))
    retry_backoff_multiplier = float(os.getenv(
        "RETRY_BACKOFF_MULTIPLIER",
        str(crawler_yaml.get('retryBackoffMultiplier', 2))
    ))
    fallback_protocol_versions = crawler_yaml.get('fallbackProtocolVersions', [])
    require_version_for_save = crawler_yaml.get('requireVersionForSave', True)

    # Validate configuration
    if max_retries < 0:
        raise ValueError(f"maxRetries must be >= 0, got {max_retries}")
    if max_retries > 10:
        print(f"WARNING: maxRetries={max_retries} is very high, crawler may be slow")

    if connection_timeout <= 0:
        raise ValueError(f"connectionTimeoutSeconds must be > 0, got {connection_timeout}")
    if extended_timeout < connection_timeout:
        raise ValueError(f"extendedTimeoutSeconds ({extended_timeout}) must be >= connectionTimeoutSeconds ({connection_timeout})")

    if initial_retry_delay <= 0:
        raise ValueError(f"initialRetryDelaySeconds must be > 0, got {initial_retry_delay}")
    if retry_backoff_multiplier < 1:
        raise ValueError(f"retryBackoffMultiplier must be >= 1, got {retry_backoff_multiplier}")

    # Validate protocol versions are integers
    if not isinstance(fallback_protocol_versions, list):
        fallback_protocol_versions = []
    else:
        for v in fallback_protocol_versions:
            if not isinstance(v, int):
                raise ValueError(f"fallbackProtocolVersions must be integers, got {type(v).__name__}: {v}")

    # Alerts configuration
    alerts_enabled = os.getenv("ALERTS_ENABLED", "true").lower() in ("true", "1", "yes")
    web_app_url = os.getenv("WEB_APP_URL", "http://localhost:4000")
    alerts_api_key = os.getenv("ALERTS_PROCESS_KEY")

    return CrawlerConfig(
        chain=chain,
        chain_config=chain_config,

        # Supabase
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),

        # RPC
        rpc_host=os.getenv("RPC_HOST"),
        rpc_port=int(os.getenv("RPC_PORT", str(chain_config.rpc_port))),
        rpc_user=os.getenv("RPC_USER"),
        rpc_pass=os.getenv("RPC_PASS"),

        # GeoIP
        geoip_db_path=geoip_path,

        # Crawler (from YAML with env var overrides)
        interval_minutes=interval_minutes,
        max_concurrent=max_concurrent,
        connection_timeout=connection_timeout,
        extended_timeout=extended_timeout,
        getaddr_delay_ms=int(os.getenv("GETADDR_DELAY_MS", "100")),
        prune_after_hours=prune_after_hours,
        max_retries=max_retries,
        initial_retry_delay=initial_retry_delay,
        retry_backoff_multiplier=retry_backoff_multiplier,
        fallback_protocol_versions=fallback_protocol_versions,
        require_version_for_save=require_version_for_save,

        # Alerts
        alerts_enabled=alerts_enabled,
        web_app_url=web_app_url,
        alerts_api_key=alerts_api_key,
    )
