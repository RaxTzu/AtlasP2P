"""
Bitcoin P2P Protocol Implementation

Handles the low-level protocol for communicating with Bitcoin-derived nodes.
Based on the Bitcoin protocol specification.
"""

import struct
import hashlib
import socket
import time
import random
from dataclasses import dataclass
from typing import List, Tuple, Optional
from .config import ChainConfig


# Protocol constants
SERVICES_NODE_NETWORK = 1
SERVICES_NODE_BLOOM = 4
SERVICES_NODE_WITNESS = 8
SERVICES_NODE_NETWORK_LIMITED = 1024


@dataclass
class NetAddr:
    """Network address structure."""
    services: int
    ip: str
    port: int
    timestamp: Optional[int] = None


@dataclass
class VersionPayload:
    """Version message payload."""
    version: int
    services: int
    timestamp: int
    addr_recv: NetAddr
    addr_from: NetAddr
    nonce: int
    user_agent: str
    start_height: int
    relay: bool


def double_sha256(data: bytes) -> bytes:
    """Compute double SHA256 hash."""
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def create_message(magic: bytes, command: str, payload: bytes = b"") -> bytes:
    """
    Create a complete protocol message.

    Format:
    - 4 bytes: Magic (network identifier)
    - 12 bytes: Command (null-padded)
    - 4 bytes: Payload length
    - 4 bytes: Checksum (first 4 bytes of double SHA256)
    - Variable: Payload
    """
    command_bytes = command.encode("ascii").ljust(12, b"\x00")
    length = struct.pack("<I", len(payload))
    checksum = double_sha256(payload)[:4]

    return magic + command_bytes + length + checksum + payload


def parse_message(data: bytes, magic: bytes) -> Tuple[str, bytes, bytes]:
    """
    Parse a protocol message.

    Returns: (command, payload, remaining_data)
    """
    if len(data) < 24:
        raise ValueError("Message too short")

    # Check magic bytes
    if data[:4] != magic:
        raise ValueError(f"Invalid magic bytes: {data[:4].hex()}")

    # Parse header
    command = data[4:16].rstrip(b"\x00").decode("ascii")
    length = struct.unpack("<I", data[16:20])[0]
    checksum = data[20:24]

    if len(data) < 24 + length:
        raise ValueError("Incomplete message")

    payload = data[24:24 + length]

    # Verify checksum
    if double_sha256(payload)[:4] != checksum:
        raise ValueError("Invalid checksum")

    return command, payload, data[24 + length:]


def create_version_message(
    chain_config: ChainConfig,
    recv_ip: str,
    recv_port: int,
    start_height: int = 0,
) -> bytes:
    """Create a version message for handshake."""

    # Current time
    timestamp = int(time.time())

    # Random nonce
    nonce = random.getrandbits(64)

    # User agent
    user_agent = f"/{chain_config.name}NodesCrawler:0.1.0/"
    user_agent_bytes = user_agent.encode("utf-8")

    # Build payload
    payload = b""

    # Version (4 bytes)
    payload += struct.pack("<I", chain_config.protocol_version)

    # Services (8 bytes)
    payload += struct.pack("<Q", SERVICES_NODE_NETWORK)

    # Timestamp (8 bytes)
    payload += struct.pack("<q", timestamp)

    # Addr_recv (26 bytes)
    payload += struct.pack("<Q", SERVICES_NODE_NETWORK)  # services
    # Handle both IPv4 and IPv6
    if ":" in recv_ip:
        # Native IPv6
        payload += socket.inet_pton(socket.AF_INET6, recv_ip)
    else:
        # IPv4-mapped IPv6
        payload += b"\x00" * 10 + b"\xff\xff"
        payload += socket.inet_pton(socket.AF_INET, recv_ip)
    payload += struct.pack(">H", recv_port)  # port (big endian)

    # Addr_from (26 bytes)
    payload += struct.pack("<Q", SERVICES_NODE_NETWORK)  # services
    # Always use 0.0.0.0 for from address (IPv4-mapped)
    payload += b"\x00" * 10 + b"\xff\xff"
    payload += socket.inet_pton(socket.AF_INET, "0.0.0.0")
    payload += struct.pack(">H", 0)  # port

    # Nonce (8 bytes)
    payload += struct.pack("<Q", nonce)

    # User agent (variable)
    payload += struct.pack("<B", len(user_agent_bytes))
    payload += user_agent_bytes

    # Start height (4 bytes)
    payload += struct.pack("<I", start_height)

    # Relay (1 byte)
    payload += struct.pack("<?", True)

    return create_message(chain_config.magic_bytes, "version", payload)


def create_verack_message(chain_config: ChainConfig) -> bytes:
    """Create a verack (version acknowledgment) message."""
    return create_message(chain_config.magic_bytes, "verack")


def create_getaddr_message(chain_config: ChainConfig) -> bytes:
    """Create a getaddr message to request peer addresses."""
    return create_message(chain_config.magic_bytes, "getaddr")


def parse_version_payload(payload: bytes) -> VersionPayload:
    """Parse a version message payload."""
    offset = 0

    # Version
    version = struct.unpack("<I", payload[offset:offset + 4])[0]
    offset += 4

    # Services
    services = struct.unpack("<Q", payload[offset:offset + 8])[0]
    offset += 8

    # Timestamp
    timestamp = struct.unpack("<q", payload[offset:offset + 8])[0]
    offset += 8

    # Addr_recv
    recv_services = struct.unpack("<Q", payload[offset:offset + 8])[0]
    offset += 8
    recv_ip_bytes = payload[offset + 12:offset + 16]
    recv_ip = socket.inet_ntoa(recv_ip_bytes)
    offset += 16
    recv_port = struct.unpack(">H", payload[offset:offset + 2])[0]
    offset += 2
    addr_recv = NetAddr(recv_services, recv_ip, recv_port)

    # Addr_from
    from_services = struct.unpack("<Q", payload[offset:offset + 8])[0]
    offset += 8
    from_ip_bytes = payload[offset + 12:offset + 16]
    from_ip = socket.inet_ntoa(from_ip_bytes)
    offset += 16
    from_port = struct.unpack(">H", payload[offset:offset + 2])[0]
    offset += 2
    addr_from = NetAddr(from_services, from_ip, from_port)

    # Nonce
    nonce = struct.unpack("<Q", payload[offset:offset + 8])[0]
    offset += 8

    # User agent
    user_agent_len = payload[offset]
    offset += 1
    user_agent = payload[offset:offset + user_agent_len].decode("utf-8", errors="replace")
    offset += user_agent_len

    # Start height
    start_height = struct.unpack("<I", payload[offset:offset + 4])[0]
    offset += 4

    # Relay (optional)
    relay = True
    if offset < len(payload):
        relay = bool(payload[offset])

    return VersionPayload(
        version=version,
        services=services,
        timestamp=timestamp,
        addr_recv=addr_recv,
        addr_from=addr_from,
        nonce=nonce,
        user_agent=user_agent,
        start_height=start_height,
        relay=relay,
    )


def parse_addr_payload(payload: bytes) -> List[NetAddr]:
    """Parse an addr message payload."""
    addresses = []
    offset = 0

    # Read varint count
    count, offset = read_varint(payload, offset)

    for _ in range(count):
        if offset + 30 > len(payload):
            break

        # Timestamp (4 bytes)
        timestamp = struct.unpack("<I", payload[offset:offset + 4])[0]
        offset += 4

        # Services (8 bytes)
        services = struct.unpack("<Q", payload[offset:offset + 8])[0]
        offset += 8

        # IP address (16 bytes - IPv6 or IPv4-mapped)
        ip_bytes = payload[offset:offset + 16]
        offset += 16

        # Check if IPv4-mapped
        if ip_bytes[:12] == b"\x00" * 10 + b"\xff\xff":
            ip = socket.inet_ntoa(ip_bytes[12:16])
        else:
            # IPv6
            ip = socket.inet_ntop(socket.AF_INET6, ip_bytes)

        # Port (2 bytes, big endian)
        port = struct.unpack(">H", payload[offset:offset + 2])[0]
        offset += 2

        addresses.append(NetAddr(services, ip, port, timestamp))

    return addresses


def read_varint(data: bytes, offset: int) -> Tuple[int, int]:
    """Read a variable-length integer."""
    first_byte = data[offset]

    if first_byte < 0xFD:
        return first_byte, offset + 1
    elif first_byte == 0xFD:
        return struct.unpack("<H", data[offset + 1:offset + 3])[0], offset + 3
    elif first_byte == 0xFE:
        return struct.unpack("<I", data[offset + 1:offset + 5])[0], offset + 5
    else:
        return struct.unpack("<Q", data[offset + 1:offset + 9])[0], offset + 9
