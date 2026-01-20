"""
Network Crawler

P2P network crawler with:
1. RPC integration for peer discovery
2. Continuous crawling loop
3. Database seeding for re-crawling
4. Configurable timeouts and concurrency
5. Comprehensive error handling
"""

import asyncio
import socket
import time
import re
import os
from dataclasses import dataclass, field, replace
from typing import Dict, List, Set, Optional
from datetime import datetime, timedelta, timezone
import structlog
import aiohttp

from .config import CrawlerConfig, load_config
from .protocol import (
    create_version_message,
    create_verack_message,
    create_getaddr_message,
    parse_message,
    parse_version_payload,
    parse_addr_payload,
    NetAddr,
)
from .geoip import GeoIPLookup
from .database import Database
from .rpc import RPCClient

logger = structlog.get_logger()


@dataclass
class NodeInfo:
    """Information about a discovered node."""
    ip: str
    port: int
    version: Optional[str] = None
    protocol_version: Optional[int] = None
    services: Optional[int] = None
    start_height: Optional[int] = None
    user_agent: Optional[str] = None
    latency_ms: Optional[float] = None
    status: str = "pending"
    first_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    times_seen: int = 1
    peers: List[NetAddr] = field(default_factory=list)


class Crawler:
    """P2P network crawler with RPC support."""

    def __init__(self, config: CrawlerConfig):
        self.config = config
        self.chain_config = config.chain_config

        # Node tracking
        self.nodes: Dict[str, NodeInfo] = {}
        self.pending: Set[str] = set()
        self.crawled: Set[str] = set()

        # Rate limiting
        self.semaphore = asyncio.Semaphore(config.max_concurrent)

        # Services
        self.geoip = GeoIPLookup(config.geoip_db_path)
        self.db = Database(config.supabase_url, config.supabase_key, config.chain)

        # RPC client (if configured)
        self.rpc: Optional[RPCClient] = None
        if config.rpc_host and config.rpc_user and config.rpc_pass:
            self.rpc = RPCClient(
                config.rpc_host,
                config.rpc_port or config.chain_config.rpc_port,
                config.rpc_user,
                config.rpc_pass,
            )
            logger.info("RPC client initialized", host=config.rpc_host, port=config.rpc_port)
        else:
            logger.warning("RPC not configured - will only use P2P discovery")

        # Stats
        self.stats = {
            "started_at": None,
            "connections_attempted": 0,
            "connections_successful": 0,
            "connections_failed": 0,
            "nodes_discovered": 0,
            "peers_from_rpc": 0,
            "peers_from_dns": 0,
            "peers_from_config": 0,
            "peers_from_p2p": 0,
            "peers_from_db": 0,
        }

        # Dynamic version from database (fetched from web API)
        # Falls back to chain_config.current_version if API unavailable
        self._dynamic_current_version: Optional[str] = None

        # Get web port from environment (defaults to 4000)
        web_port = os.getenv('WEB_PORT', '4000')

        self._web_api_url = config.supabase_url.replace('/rest/v1', '').rstrip('/')
        # Convert Supabase URL to web app URL (typically on same host)
        if '127.0.0.1:4020' in self._web_api_url or 'localhost:4020' in self._web_api_url:
            self._web_api_url = f'http://localhost:{web_port}'
        elif 'supabase' in self._web_api_url:
            # Docker internal - web app is on atlasp2p-web with configured port
            self._web_api_url = f'http://atlasp2p-web:{web_port}'

    async def _fetch_current_version(self) -> str:
        """
        Fetch current version from web API (database overrides).
        Falls back to YAML config if API unavailable.
        """
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self._web_api_url}/api/config/chain"
                logger.debug("Fetching current version from API", url=url)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        version = data.get('currentVersion')
                        if version:
                            self._dynamic_current_version = version
                            logger.info("Fetched current version from API", version=version)
                            return version
        except Exception as e:
            logger.warning("Failed to fetch version from API, using config", error=str(e))

        # Fallback to YAML config
        return self.chain_config.current_version

    def _get_current_version(self) -> str:
        """Get the current version (dynamic or from config)."""
        return self._dynamic_current_version or self.chain_config.current_version

    def _node_key(self, ip: str, port: int) -> str:
        """Create a unique key for a node."""
        return f"{ip}:{port}"

    async def _connect_and_handshake(
        self,
        ip: str,
        port: int,
    ) -> Optional[NodeInfo]:
        """
        Connect to a node, perform handshake, and request addresses.

        Implements retry logic with exponential backoff and protocol negotiation.
        Configured via project.config.yaml crawlerConfig section.

        Returns NodeInfo with:
        - status="up" on successful handshake
        - status="reachable" if TCP connects but handshake fails after all retries
        - None if TCP connection fails entirely after all retries
        """
        # Build list of protocol versions to try (primary + fallbacks)
        # Ensure fallback_protocol_versions is a list (handle None/empty gracefully)
        fallback_versions = self.config.fallback_protocol_versions or []
        protocol_versions = [self.chain_config.protocol_version] + fallback_versions

        last_result = None  # Track last attempt result
        last_error = None   # Track last error

        # Retry loop with exponential backoff
        for attempt in range(self.config.max_retries + 1):  # +1 for initial attempt
            # Calculate retry delay (skip on first attempt)
            if attempt > 0:
                delay = self.config.initial_retry_delay * (self.config.retry_backoff_multiplier ** (attempt - 1))
                logger.debug(
                    "Retry attempt after backoff",
                    ip=ip,
                    port=port,
                    attempt=attempt + 1,
                    max_attempts=self.config.max_retries + 1,
                    backoff_seconds=delay
                )
                await asyncio.sleep(delay)

            # Try each protocol version on this attempt
            for protocol_idx, protocol_version in enumerate(protocol_versions):
                # Log attempt details
                if attempt == 0 and protocol_idx == 0:
                    logger.debug("Initial connection attempt", ip=ip, port=port, protocol_version=protocol_version)
                elif protocol_idx > 0:
                    logger.debug(
                        "Trying fallback protocol",
                        ip=ip,
                        port=port,
                        protocol_version=protocol_version,
                        fallback_index=protocol_idx
                    )

                # Determine timeout: use extended timeout for "reachable" nodes on retry
                if last_result and last_result.status == "reachable" and attempt > 0:
                    timeout = self.config.extended_timeout
                    logger.debug(
                        "Using extended timeout for reachable node",
                        ip=ip,
                        port=port,
                        timeout=timeout
                    )
                else:
                    timeout = self.config.connection_timeout

                # Attempt connection with current protocol version
                result = await self._try_connect_with_protocol(
                    ip, port, protocol_version, timeout
                )

                # Success! Return immediately
                if result and result.status == "up":
                    if attempt > 0 or protocol_idx > 0:
                        logger.info(
                            "Connection successful after retry/fallback",
                            ip=ip,
                            port=port,
                            attempt=attempt + 1,
                            protocol_version=protocol_version,
                            status=result.status
                        )
                    return result

                # Update last result for next iteration
                last_result = result

                # TCP connected but handshake failed - try next protocol version
                if result and result.status == "reachable":
                    continue  # Try next protocol version

                # TCP connection failed - no point trying other protocols
                if result is None:
                    last_error = "TCP connection failed"
                    break  # Move to next retry attempt

        # All retries exhausted
        if last_result and last_result.status == "reachable":
            logger.debug(
                "Node reachable but handshake failed after all retries",
                ip=ip,
                port=port,
                attempts=self.config.max_retries + 1,
                protocols_tried=len(protocol_versions)
            )
            return last_result  # Return "reachable" status

        logger.debug(
            "Connection failed after all retries",
            ip=ip,
            port=port,
            attempts=self.config.max_retries + 1,
            last_error=last_error
        )
        return None

    async def _try_connect_with_protocol(
        self,
        ip: str,
        port: int,
        protocol_version: int,
        timeout: int,
    ) -> Optional[NodeInfo]:
        """
        Single connection attempt with specified protocol version.

        This is called by _connect_and_handshake() for each retry/protocol combination.
        """
        start_time = time.time()

        try:
            # Connect with timeout
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=timeout,
            )

            # TCP connected! Create node info - will be "reachable" at minimum
            tcp_latency = (time.time() - start_time) * 1000

            try:
                # Create protocol override for version message
                # Only override protocol_version, keep all other fields from chain_config
                chain_config_override = replace(
                    self.chain_config,
                    protocol_version=protocol_version
                )

                # Send version message with specified protocol version
                version_msg = create_version_message(
                    chain_config_override,
                    ip,
                    port,
                    start_height=0,
                )
                writer.write(version_msg)
                await writer.drain()

                # Read response - may come in multiple chunks!
                # Keep reading until we have a complete VERSION message
                data = b""
                read_timeout = timeout
                start_read = time.time()

                while (time.time() - start_read) < read_timeout:
                    try:
                        chunk = await asyncio.wait_for(
                            reader.read(65536),
                            timeout=2,  # Short timeout per chunk
                        )

                        if not chunk:
                            # Connection closed
                            logger.debug("Connection closed while reading", ip=ip, port=port, bytes_received=len(data))
                            break

                        data += chunk
                        logger.debug("Received chunk", ip=ip, port=port, chunk_size=len(chunk), total_size=len(data))

                        # Check if we have at least a header
                        if len(data) >= 24:
                            # Try to determine if we have a complete message
                            import struct
                            length = struct.unpack("<I", data[16:20])[0]
                            needed = 24 + length
                            logger.debug("Message size check", ip=ip, port=port, have=len(data), need=needed)

                            if len(data) >= needed:
                                # Have at least one complete message
                                logger.debug("Have complete message", ip=ip, port=port)
                                break

                    except asyncio.TimeoutError:
                        # Short read timeout - check if we have enough data
                        logger.debug("Read timeout", ip=ip, port=port, bytes_received=len(data))
                        if len(data) >= 24:
                            import struct
                            length = struct.unpack("<I", data[16:20])[0]
                            needed = 24 + length
                            if len(data) >= needed:
                                break
                        # No complete message yet, continue if overall timeout not exceeded
                        continue

                if not data:
                    # TCP connected but no response - mark as reachable
                    logger.debug("TCP connected but no handshake response", ip=ip, port=port)
                    return NodeInfo(ip=ip, port=port, status="reachable", latency_ms=tcp_latency)

                logger.debug("Starting message parse", ip=ip, port=port, data_size=len(data), data_hex=data[:50].hex())

                # Parse version response
                remaining = data
                node_info = NodeInfo(ip=ip, port=port)
                received_version = False
                received_verack = False

                while remaining:
                    try:
                        command, payload, remaining = parse_message(
                            remaining,
                            self.chain_config.magic_bytes,
                        )

                        if command == "version":
                            version_data = parse_version_payload(payload)
                            node_info.version = version_data.user_agent
                            node_info.protocol_version = version_data.version
                            node_info.services = version_data.services
                            node_info.start_height = version_data.start_height
                            node_info.user_agent = version_data.user_agent
                            received_version = True

                            # Send verack
                            verack_msg = create_verack_message(self.chain_config)
                            writer.write(verack_msg)
                            await writer.drain()

                        elif command == "verack":
                            received_verack = True

                    except ValueError as e:
                        logger.warning(
                            "Failed to parse message",
                            ip=ip,
                            port=port,
                            error=str(e),
                            data_hex=remaining[:64].hex() if remaining else "empty",
                            expected_magic=self.chain_config.magic_bytes.hex(),
                        )
                        break

                if not received_version:
                    # TCP connected, got data, but couldn't parse version - mark as reachable
                    logger.debug("TCP connected but version parse failed", ip=ip, port=port)
                    return NodeInfo(ip=ip, port=port, status="reachable", latency_ms=tcp_latency)

                # Calculate latency
                node_info.latency_ms = (time.time() - start_time) * 1000
                node_info.status = "up"

                # Request addresses (getaddr)
                await asyncio.sleep(self.config.getaddr_delay_ms / 1000)

                getaddr_msg = create_getaddr_message(self.chain_config)
                writer.write(getaddr_msg)
                await writer.drain()

                # Wait for addr response - keep reading until we get it or timeout
                # Nodes may send other messages (ping, inv) before addr
                try:
                    start_time = time.time()
                    addr_timeout = 60  # 60 seconds to receive addr response
                    buffer = b""

                    while (time.time() - start_time) < addr_timeout:
                        try:
                            # Read with short timeout to allow checking time
                            chunk = await asyncio.wait_for(
                                reader.read(65536),
                                timeout=5,
                            )

                            if not chunk:
                                break  # Connection closed

                            buffer += chunk

                            # Try to parse all messages in buffer
                            remaining = buffer
                            buffer = b""
                            addr_found = False

                            while remaining:
                                try:
                                    command, payload, remaining = parse_message(
                                        remaining,
                                        self.chain_config.magic_bytes,
                                    )

                                    if command == "addr":
                                        node_info.peers = parse_addr_payload(payload)
                                        self.stats["peers_from_p2p"] += len(node_info.peers)
                                        logger.debug(
                                            "Received addr response",
                                            ip=ip,
                                            port=port,
                                            peer_count=len(node_info.peers)
                                        )
                                        addr_found = True
                                        break  # Got what we need

                                    # Ignore other messages (ping, inv, etc.)

                                except ValueError:
                                    # Incomplete message, save for next iteration
                                    buffer = remaining
                                    break

                            if addr_found:
                                break  # Exit outer loop

                        except asyncio.TimeoutError:
                            # Short timeout expired, check if we should continue
                            continue

                    if not node_info.peers:
                        logger.debug("No addr response after 60s", ip=ip, port=port)

                except Exception as e:
                    logger.debug("Error waiting for addr", ip=ip, port=port, error=str(e))

                return node_info

            finally:
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass

        except (asyncio.TimeoutError, ConnectionRefusedError, OSError) as e:
            logger.debug("Connection attempt failed", ip=ip, port=port, protocol_version=protocol_version, error=str(e))
            return None

        except Exception as e:
            logger.warning("Unexpected error in connection attempt", ip=ip, port=port, protocol_version=protocol_version, error=str(e))
            return None

    async def _crawl_node(self, ip: str, port: int) -> None:
        """Crawl a single node."""
        key = self._node_key(ip, port)

        # CRITICAL: Remove from pending FIRST to prevent infinite loops
        # (even if already crawled, must remove from pending)
        self.pending.discard(key)

        if key in self.crawled:
            return

        async with self.semaphore:
            self.stats["connections_attempted"] += 1

            node_info = await self._connect_and_handshake(ip, port)

            self.crawled.add(key)

            if node_info:
                self.stats["connections_successful"] += 1

                # Update or add node
                if key in self.nodes:
                    existing = self.nodes[key]
                    # Only update version info if we got a full handshake
                    if node_info.status == "up":
                        existing.version = node_info.version
                        existing.protocol_version = node_info.protocol_version
                        existing.services = node_info.services
                        existing.start_height = node_info.start_height
                        existing.peers = node_info.peers
                    existing.latency_ms = node_info.latency_ms
                    existing.status = node_info.status  # Preserve status from handshake result
                    existing.last_seen = datetime.now(timezone.utc)
                    existing.times_seen += 1
                else:
                    self.nodes[key] = node_info
                    self.stats["nodes_discovered"] += 1

                # Add discovered peers to pending
                for peer in node_info.peers:
                    peer_key = self._node_key(peer.ip, peer.port)
                    if peer_key not in self.crawled and peer_key not in self.pending:
                        # Validate IP
                        if self._is_valid_ip(peer.ip):
                            self.pending.add(peer_key)

            else:
                self.stats["connections_failed"] += 1

                # BITNODES-STYLE: Save ALL discovered nodes, even unreachable
                if key in self.nodes:
                    # Already exists - mark as down
                    self.nodes[key].status = "down"
                    self.nodes[key].last_seen = datetime.now(timezone.utc)
                else:
                    # NEW: Add unreachable node to database
                    # This matches Bitnodes methodology - track all discovered peers
                    node_info_unreachable = NodeInfo(
                        ip=ip,
                        port=port,
                        status="down",
                        latency_ms=None,
                        version=None,
                        protocol_version=None,
                        services=None,
                        start_height=None,
                        user_agent=None,
                        peers=[],
                        last_seen=datetime.now(timezone.utc),
                        first_seen=datetime.now(timezone.utc),
                        times_seen=0,
                    )
                    self.nodes[key] = node_info_unreachable
                    self.stats["nodes_discovered"] += 1

    def _is_valid_ip(self, ip: str) -> bool:
        """Check if an IP is valid and not private (unless in development mode)."""
        try:
            # IPv6 support - protocol.py now uses inet_pton which supports both IPv4 and IPv6
            if ":" in ip:
                # Basic IPv6 validation - skip loopback and link-local
                if ip.startswith("::1") or ip.startswith("fe80:") or ip.startswith("fc00:") or ip.startswith("fd00:"):
                    return False
                return True  # Accept all other IPv6

            # IPv4 validation
            parts = ip.split(".")
            if len(parts) != 4:
                return False

            nums = [int(p) for p in parts]

            # Allow private IPs in development mode (for local testing)
            is_development = os.getenv("NODE_ENV", "").lower() == "development"

            # Private ranges
            if nums[0] == 10:
                return is_development
            if nums[0] == 172 and 16 <= nums[1] <= 31:
                return is_development
            if nums[0] == 192 and nums[1] == 168:
                return is_development
            if nums[0] == 127:
                return is_development
            if nums[0] == 0:
                return False

            return True

        except Exception:
            return False

    async def _resolve_dns_seeds(self) -> List[str]:
        """Resolve DNS seeds to get initial nodes."""
        nodes = []

        for seed in self.chain_config.dns_seeds:
            try:
                # DNS lookup
                loop = asyncio.get_event_loop()
                addrs = await loop.run_in_executor(
                    None,
                    socket.gethostbyname_ex,
                    seed,
                )

                for ip in addrs[2]:
                    if self._is_valid_ip(ip):
                        nodes.append(ip)

                logger.info("Resolved DNS seed", seed=seed, count=len(addrs[2]))

            except Exception as e:
                logger.warning("Failed to resolve DNS seed", seed=seed, error=str(e))

        return nodes

    def _normalize_version(self, version: str) -> tuple:
        """
        Normalize a version string to a tuple of integers for comparison.
        Handles both 3-part (1.18.0) and 4-part (1.18.0.0) versions.

        Examples:
          "1.18.0" -> (1, 18, 0, 0)
          "1.18.0.0" -> (1, 18, 0, 0)
          "1.16.0.9" -> (1, 16, 0, 9)
          "v1.18.0" -> (1, 18, 0, 0)  # strips 'v' prefix
        """
        # Strip common prefixes
        version = version.strip().lstrip('v').lstrip('V')

        # Split by '.' and convert to integers
        parts = version.split('.')
        normalized = []
        for part in parts[:4]:  # Max 4 parts
            # Extract numeric part only (handles "1.18.0rc1" -> "0")
            numeric = ''.join(c for c in part if c.isdigit())
            normalized.append(int(numeric) if numeric else 0)

        # Pad to 4 parts with zeros
        while len(normalized) < 4:
            normalized.append(0)

        return tuple(normalized[:4])

    def _versions_match(self, version1: str, version2: str) -> bool:
        """
        Compare two version strings for equality, handling different formats.

        Examples:
          "1.18.0" == "1.18.0.0" -> True
          "1.18.0" == "1.18.0" -> True
          "1.16.0.9" == "1.16.0.9" -> True
          "1.18.0" == "1.17.0" -> False
        """
        return self._normalize_version(version1) == self._normalize_version(version2)

    def _parse_version(self, user_agent: str) -> Dict:
        """Parse user agent to extract version info."""
        pattern = self.chain_config.user_agent_pattern
        match = re.search(pattern, user_agent)

        if match:
            # Pattern may have 1 or 2 groups depending on if client name is captured
            groups = match.groups()
            if len(groups) >= 2:
                client_name = groups[0]  # e.g., "Gotoshi" or "Dingocoin"
                version = groups[1]      # e.g., "1.18.0"
            else:
                client_name = self.chain_config.name
                version = groups[0]

            parts = version.split(".")
            return {
                "client_name": client_name,
                "client_version": version,
                "version_major": int(parts[0]) if len(parts) > 0 else 0,
                "version_minor": int(parts[1]) if len(parts) > 1 else 0,
                "version_patch": int(parts[2]) if len(parts) > 2 else 0,
            }

        return {
            "client_name": "Unknown",
            "client_version": user_agent,
            "version_major": 0,
            "version_minor": 0,
            "version_patch": 0,
        }

    async def _seed_from_database(self) -> None:
        """Load previously discovered nodes from database."""
        logger.info("Seeding from database")

        try:
            db_nodes = await self.db.get_all_nodes()

            for node in db_nodes:
                ip = node.get("ip")
                port = node.get("port", self.chain_config.p2p_port)

                if not ip:
                    continue

                # Convert INET to string if needed
                if hasattr(ip, 'compressed'):
                    ip = str(ip)

                key = self._node_key(str(ip), port)
                status = node.get("status", "unknown")

                # Re-crawl logic based on node status
                last_seen = node.get("last_seen")
                should_crawl = False

                if last_seen:
                    try:
                        # Parse timestamp
                        if isinstance(last_seen, str):
                            last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                        else:
                            last_seen_dt = last_seen

                        # Ensure last_seen_dt is timezone-aware (assume UTC if naive)
                        if last_seen_dt.tzinfo is None:
                            last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)
                        minutes_since = (datetime.now(timezone.utc) - last_seen_dt).total_seconds() / 60

                        # Always re-check "up" and "reachable" nodes to detect outages quickly
                        # These nodes should be checked every crawl pass
                        if status in ("up", "reachable"):
                            should_crawl = True
                        # Re-check "down" nodes less frequently (every 30 minutes)
                        elif status == "down" and minutes_since > 30:
                            should_crawl = True
                        # Re-check unknown/other status nodes every 10 minutes
                        elif minutes_since > 10:
                            should_crawl = True

                    except Exception as e:
                        logger.debug("Failed to parse last_seen", error=str(e))
                        should_crawl = True
                else:
                    should_crawl = True

                if should_crawl:
                    self.pending.add(key)
                    self.stats["peers_from_db"] += 1

            logger.info("Seeded from database", count=self.stats["peers_from_db"])

        except Exception as e:
            logger.error("Failed to seed from database", error=str(e))

    async def _seed_from_rpc(self) -> None:
        """Seed from RPC getpeerinfo (CRITICAL NEW FEATURE)."""
        if not self.rpc:
            return

        try:
            # Test connection first
            if not await self.rpc.test_connection():
                logger.warning("RPC connection test failed, skipping RPC seeding")
                return

            rpc_peers = await self.rpc.get_all_peers()
            for ip, port in rpc_peers:
                if self._is_valid_ip(ip):
                    key = self._node_key(ip, port)
                    self.pending.add(key)
                    self.stats["peers_from_rpc"] += 1

            logger.info("Seeded from RPC", count=len(rpc_peers))

        except Exception as e:
            logger.error("Failed to seed from RPC", error=str(e))

    async def _test_address_reachable(self, ip: str, port: int) -> bool:
        """Test if an address is reachable via TCP."""
        import socket
        try:
            if ":" in ip:
                sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
            else:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3)
            result = sock.connect_ex((ip, port))
            sock.close()
            return result == 0
        except Exception:
            return False

    async def _mark_rpc_node_as_up(self) -> None:
        """
        Mark the RPC node as "up" since we know it's online.

        The RPC node is the local node we connect to for peer discovery.
        Since we can communicate with it via RPC, we know it's definitely online,
        even if P2P connections from Docker might fail due to networking issues.

        SMART MODE: Tests which address is actually reachable from outside,
        prefers IPv4 if reachable (more universal), falls back to IPv6.
        One physical node = one database entry.
        """
        if not self.rpc:
            return

        try:
            local_info = await self.rpc.get_local_node_info()
            if not local_info or not local_info.get("local_addresses"):
                logger.debug("No local addresses found for RPC node")
                return

            version = local_info.get("subversion", "")
            protocol_version = local_info.get("version")
            addresses = local_info["local_addresses"]

            # Separate IPv4 and IPv6 addresses
            ipv4_addrs = [(ip, port) for ip, port in addresses if ":" not in ip]
            ipv6_addrs = [(ip, port) for ip, port in addresses if ":" in ip]

            # Smart mode: test reachability and pick the best one
            selected_ip = None
            selected_port = None

            # Try IPv4 first (more universally accessible if it works)
            for ip, port in ipv4_addrs:
                logger.debug("Testing IPv4 reachability", ip=ip, port=port)
                if await self._test_address_reachable(ip, port):
                    selected_ip, selected_port = ip, port
                    logger.info("IPv4 address reachable", ip=ip, port=port)
                    break
                else:
                    logger.debug("IPv4 address not reachable", ip=ip, port=port)

            # Fall back to IPv6 if no IPv4 is reachable
            if not selected_ip:
                for ip, port in ipv6_addrs:
                    logger.debug("Testing IPv6 reachability", ip=ip, port=port)
                    if await self._test_address_reachable(ip, port):
                        selected_ip, selected_port = ip, port
                        logger.info("IPv6 address reachable", ip=ip, port=port)
                        break
                    else:
                        logger.debug("IPv6 address not reachable", ip=ip, port=port)

            # If nothing is externally reachable, just use first available (node is still up via RPC)
            if not selected_ip:
                if ipv4_addrs:
                    selected_ip, selected_port = ipv4_addrs[0]
                    logger.warning("No address externally reachable, using IPv4 anyway", ip=selected_ip)
                elif ipv6_addrs:
                    selected_ip, selected_port = ipv6_addrs[0]
                    logger.warning("No address externally reachable, using IPv6 anyway", ip=selected_ip)
                else:
                    logger.debug("No valid addresses found for RPC node")
                    return

            key = self._node_key(selected_ip, selected_port)

            # Create or update node info
            node_info = NodeInfo(
                ip=selected_ip,
                port=selected_port,
                version=version,
                protocol_version=protocol_version,
                services=1,  # NODE_NETWORK
                status="up",
                latency_ms=1.0,  # Local node, minimal latency
                user_agent=version,
            )

            self.nodes[key] = node_info
            # Remove from pending since we already know it's up
            self.pending.discard(key)
            self.crawled.add(key)

            # Also remove the other addresses from pending to avoid duplicate crawl attempts
            for other_ip, other_port in addresses:
                other_key = self._node_key(other_ip, other_port)
                self.pending.discard(other_key)

            logger.info(
                "Marked RPC node as up (smart mode)",
                ip=selected_ip,
                port=selected_port,
                version=version,
            )

        except Exception as e:
            logger.warning("Failed to mark RPC node as up", error=str(e))

    async def _seed_from_dns(self) -> None:
        """Seed from DNS seeds."""
        seed_ips = await self._resolve_dns_seeds()

        for ip in seed_ips:
            key = self._node_key(ip, self.chain_config.p2p_port)
            self.pending.add(key)
            self.stats["peers_from_dns"] += 1

        logger.info("Seeded from DNS", count=len(seed_ips))

    async def _seed_from_config(self) -> None:
        """Seed from configured seed nodes (direct IP:port addresses)."""
        seed_nodes = self.chain_config.seed_nodes
        if not seed_nodes:
            logger.debug("No seed nodes configured in project.config.yaml")
            return

        count = 0
        for node_addr in seed_nodes:
            try:
                # Handle IPv6 addresses with brackets: [2400:6180:10:200::1167:7000]:33117
                if node_addr.startswith("["):
                    # IPv6 with port
                    bracket_end = node_addr.find("]")
                    if bracket_end == -1:
                        logger.warning("Invalid IPv6 seed node format", addr=node_addr)
                        continue
                    ip = node_addr[1:bracket_end]  # Remove brackets
                    port_str = node_addr[bracket_end + 1:]
                    if port_str.startswith(":"):
                        port = int(port_str[1:])
                    else:
                        port = self.chain_config.p2p_port
                elif ":" in node_addr and node_addr.count(":") == 1:
                    # IPv4 with port (e.g., 158.220.104.128:33117)
                    ip, port_str = node_addr.rsplit(":", 1)
                    port = int(port_str)
                elif ":" in node_addr:
                    # IPv6 without port (e.g., 2400:6180:10:200::1167:7000)
                    ip = node_addr
                    port = self.chain_config.p2p_port
                else:
                    # IPv4 without port
                    ip = node_addr
                    port = self.chain_config.p2p_port

                if self._is_valid_ip(ip):
                    key = self._node_key(ip, port)
                    if key not in self.crawled and key not in self.pending:
                        self.pending.add(key)
                        self.stats["peers_from_config"] += 1
                        count += 1

            except Exception as e:
                logger.warning("Failed to parse seed node", addr=node_addr, error=str(e))

        if count > 0:
            logger.info("Seeded from config seed nodes", count=count)

    async def _crawl_pending(self) -> None:
        """Crawl all pending nodes."""
        while self.pending:
            batch = list(self.pending)[:self.config.max_concurrent]

            tasks = []
            for key in batch:
                ip, port = key.rsplit(":", 1)
                tasks.append(self._crawl_node(ip, int(port)))

            await asyncio.gather(*tasks, return_exceptions=True)

            logger.info(
                "Crawl progress",
                pending=len(self.pending),
                crawled=len(self.crawled),
                discovered=len(self.nodes),
            )

    async def _prune_stale_nodes(self) -> None:
        """Remove nodes not seen in configured hours."""
        try:
            await self.db.prune_stale_nodes(self.config.prune_after_hours)
        except Exception as e:
            logger.error("Failed to prune stale nodes", error=str(e))

    async def run_single_pass(self) -> None:
        """Run a single crawl pass."""
        logger.info("Starting crawl pass", chain=self.config.chain)
        self.stats["started_at"] = datetime.now(timezone.utc)

        # Fetch current version from web API (database overrides)
        await self._fetch_current_version()
        logger.info("Using current version for comparison", version=self._get_current_version())

        # Reset state for new pass (important for re-checking all nodes)
        self.nodes.clear()
        self.crawled.clear()
        self.pending.clear()

        # Reset counters
        self.stats["peers_from_rpc"] = 0
        self.stats["peers_from_dns"] = 0
        self.stats["peers_from_config"] = 0
        self.stats["peers_from_p2p"] = 0
        self.stats["peers_from_db"] = 0

        # Seed from database first (re-crawl known nodes)
        await self._seed_from_database()

        # Seed from RPC (CRITICAL for discovering local node peers)
        await self._seed_from_rpc()

        # Mark the RPC node itself as "up" (we know it's online via RPC)
        await self._mark_rpc_node_as_up()

        # Seed from DNS (fallback/bootstrap)
        await self._seed_from_dns()

        # Seed from configured seed nodes (guaranteed discovery)
        await self._seed_from_config()

        if not self.pending:
            logger.error("No seed nodes found from any source!")
            return

        logger.info(
            "Starting crawl with seeds",
            total_pending=len(self.pending),
            from_db=self.stats["peers_from_db"],
            from_rpc=self.stats["peers_from_rpc"],
            from_dns=self.stats["peers_from_dns"],
            from_config=self.stats["peers_from_config"],
        )

        # Crawl all pending nodes
        await self._crawl_pending()

        logger.info(
            "Crawl pass complete",
            total_nodes=len(self.nodes),
            online_nodes=sum(1 for n in self.nodes.values() if n.status == "up"),
            connections_attempted=self.stats["connections_attempted"],
            connections_successful=self.stats["connections_successful"],
            peers_discovered=self.stats["peers_from_p2p"],
        )

        # Save to database
        await self._save_to_database()

        # Create network snapshot (hourly, with automatic deduplication)
        await self.db.create_network_snapshot()

        # Cleanup stale nodes
        await self._prune_stale_nodes()

    async def run(self) -> None:
        """Run continuous crawler (runs indefinitely)."""
        logger.info(
            "Starting continuous crawler",
            chain=self.config.chain,
            interval_minutes=self.config.interval_minutes,
        )

        iteration = 0
        while True:
            iteration += 1
            logger.info("=" * 60)
            logger.info(f"CRAWL ITERATION {iteration}")
            logger.info("=" * 60)

            try:
                await self.run_single_pass()
            except Exception as e:
                logger.error("Crawl iteration failed", iteration=iteration, error=str(e))

            # Wait before next iteration
            next_run = datetime.now(timezone.utc) + timedelta(minutes=self.config.interval_minutes)
            logger.info(
                "Waiting for next iteration",
                minutes=self.config.interval_minutes,
                next_run=next_run.isoformat(),
            )
            await asyncio.sleep(self.config.interval_minutes * 60)

    async def _save_to_database(self) -> None:
        """Save discovered nodes to the database."""
        logger.info("Saving nodes to database", count=len(self.nodes))

        skipped_no_version = 0
        debug_count = 0
        for key, node in self.nodes.items():
            try:
                # Filter: Skip nodes without version data if configured
                if self.config.require_version_for_save:
                    if not node.user_agent or not node.protocol_version:
                        skipped_no_version += 1
                        logger.debug(
                            "Skipping node without version data",
                            ip=node.ip,
                            port=node.port,
                            status=node.status,
                            reason="requireVersionForSave=true in config"
                        )
                        continue

                # GeoIP lookup
                geo = self.geoip.lookup(node.ip)

                # Parse version
                version_info = self._parse_version(node.user_agent or "")

                # Check if current version (use dynamic version from database)
                current_version = self._get_current_version()
                # Use smart semver comparison (handles 1.18.0 == 1.18.0.0)
                node_version = version_info.get("client_version", "")
                is_current = self._versions_match(node_version, current_version)

                # Temporary debugging - log first 3 nodes only
                if debug_count < 3:
                    logger.info(
                        "Version comparison DEBUG",
                        node_ip=node.ip,
                        node_version=node_version,
                        current_version=current_version,
                        is_current=is_current,
                        type_is_current=type(is_current),
                        normalized_node=self._normalize_version(node_version),
                        normalized_current=self._normalize_version(current_version)
                    )
                    debug_count += 1

                # Prepare node data
                node_data = {
                    "ip": node.ip,
                    "port": node.port,
                    "chain": self.config.chain,
                    "version": node.user_agent,
                    "protocol_version": node.protocol_version,
                    "services": int(node.services) if node.services is not None else None,  # Explicit cast to int for bigint column
                    "start_height": node.start_height,
                    "client_name": version_info.get("client_name"),
                    "client_version": version_info.get("client_version"),
                    "version_major": version_info.get("version_major"),
                    "version_minor": version_info.get("version_minor"),
                    "version_patch": version_info.get("version_patch"),
                    "is_current_version": is_current,
                    "country_code": geo.get("country_code"),
                    "country_name": geo.get("country_name"),
                    "region": geo.get("region"),
                    "city": geo.get("city"),
                    "latitude": geo.get("latitude"),
                    "longitude": geo.get("longitude"),
                    "timezone": geo.get("timezone"),
                    "isp": geo.get("isp"),
                    "org": geo.get("org"),
                    "asn": geo.get("asn"),
                    "asn_org": geo.get("asn_org"),
                    "status": node.status,
                    "latency_ms": node.latency_ms,
                    "last_seen": node.last_seen.isoformat(),
                    "first_seen": node.first_seen.isoformat(),
                    "times_seen": node.times_seen,
                }

                # Upsert node and get the node_id
                node_id = await self.db.upsert_node(node_data)

                # Create snapshot for historical tracking
                if node_id:
                    is_online = node.status == "up"
                    await self.db.create_node_snapshot(
                        node_id=node_id,
                        is_online=is_online,
                        response_time_ms=node.latency_ms if is_online else None,
                        block_height=node.start_height if is_online else None,
                    )

            except Exception as e:
                logger.error("Failed to save node", ip=node.ip, error=str(e))

        logger.info(
            "Nodes saved to database",
            saved=len(self.nodes) - skipped_no_version,
            skipped_no_version=skipped_no_version,
            require_version_for_save=self.config.require_version_for_save
        )

        # Process alerts for nodes that changed status
        await self._process_alerts()

    async def _process_alerts(self) -> None:
        """Call the alerts processing API endpoint."""
        if not self.config.supabase_url:
            return

        try:
            # Get web port from environment (defaults to 4000)
            web_port = os.getenv('WEB_PORT', '4000')

            # Build the API URL - handle both internal and external URLs
            base_url = self.config.supabase_url
            if "kong:8000" in base_url:
                # Internal docker URL, use the web service instead
                api_url = f"http://web:{web_port}/api/alerts/process"
            elif "localhost" in base_url or "127.0.0.1" in base_url:
                # Local development - use localhost web port
                api_url = f"http://localhost:{web_port}/api/alerts/process"
            else:
                # Production - derive from supabase URL
                api_url = base_url.replace("/supabase", "") + "/api/alerts/process"

            async with aiohttp.ClientSession() as session:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.config.supabase_key}",
                }
                async with session.post(api_url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        if result.get("processed", 0) > 0:
                            logger.info("Alerts processed", count=result.get("processed", 0))
                    else:
                        logger.warning("Alert processing failed", status=resp.status)
        except Exception as e:
            logger.debug("Alert processing error", error=str(e))


async def main():
    """Main entry point."""
    config = load_config()
    crawler = Crawler(config)
    await crawler.run()


if __name__ == "__main__":
    asyncio.run(main())
