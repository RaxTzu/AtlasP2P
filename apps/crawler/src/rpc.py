"""
RPC Client for Dingocoin Node

Fetches connected peers via JSON-RPC to enhance node discovery.
This is a critical component for comprehensive network mapping.
"""

import aiohttp
import base64
from typing import List, Dict, Optional
import structlog

logger = structlog.get_logger()


class RPCClient:
    """JSON-RPC client for blockchain node communication."""

    def __init__(self, host: str, port: int, user: str, password: str):
        """
        Initialize RPC client.

        Args:
            host: RPC server hostname/IP
            port: RPC server port (22892 for Dingocoin)
            user: RPC username
            password: RPC password
        """
        self.url = f"http://{host}:{port}"
        self.auth = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.enabled = True

    async def call(self, method: str, params: list = None) -> Dict:
        """
        Make an RPC call to the blockchain node.

        Args:
            method: RPC method name (e.g., 'getpeerinfo')
            params: List of parameters for the method

        Returns:
            Result dictionary from RPC response
        """
        headers = {
            "Authorization": f"Basic {self.auth}",
            "Content-Type": "application/json",
        }
        payload = {
            "jsonrpc": "1.0",
            "id": "crawler",
            "method": method,
            "params": params or [],
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.url,
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as resp:
                    data = await resp.json()
                    if "error" in data and data["error"]:
                        error_code = data["error"].get("code") if isinstance(data["error"], dict) else None
                        # Error -24 is expected when getaddednodeinfo is called with no manually added nodes
                        if error_code == -24 and method == "getaddednodeinfo":
                            logger.debug("No manually added nodes (expected)", method=method)
                            return []
                        raise Exception(f"RPC error: {data['error']}")
                    return data.get("result", {})
        except Exception as e:
            logger.warning("RPC call failed", method=method, error=str(e))
            return {}

    async def getpeerinfo(self) -> List[Dict]:
        """
        Get information about connected peers.

        Returns list of peer info dictionaries with:
        - addr: IP:port of peer
        - version: Protocol version
        - subver: User agent
        - conntime: Connection time
        - bytessent/bytesrecv: Traffic stats
        """
        result = await self.call("getpeerinfo")
        return result if isinstance(result, list) else []

    async def getaddednodeinfo(self, dns: bool = True) -> List[Dict]:
        """
        Get info about manually added nodes (addnode command).

        Args:
            dns: Whether to resolve DNS names

        Returns:
            List of added node info
        """
        result = await self.call("getaddednodeinfo", [dns])
        return result if isinstance(result, list) else []

    async def getconnectioncount(self) -> int:
        """
        Get total number of peer connections.

        Returns:
            Number of connections
        """
        result = await self.call("getconnectioncount")
        return result if isinstance(result, int) else 0

    async def getnetworkinfo(self) -> Dict:
        """
        Get network information including version, connections, protocols.

        Returns:
            Network info dictionary
        """
        return await self.call("getnetworkinfo")

    async def get_all_peers(self) -> List[tuple]:
        """
        Get all known peers from RPC node.

        This is the primary method for RPC-based node discovery.
        Combines peers from:
        1. getpeerinfo() - currently connected peers
        2. getaddednodeinfo() - manually added nodes

        Returns:
            List of (ip, port) tuples
        """
        peers = []

        # Get connected peers
        peer_info = await self.getpeerinfo()
        for peer in peer_info:
            addr = peer.get("addr", "")
            if ":" in addr:
                # Handle both IPv4 and IPv6
                # IPv4: "1.2.3.4:33117"
                # IPv6: "[::1]:33117"
                if addr.startswith("["):
                    # IPv6 format
                    ip, port = addr.rsplit("]:", 1)
                    ip = ip[1:]  # Remove leading [
                else:
                    # IPv4 format
                    ip, port = addr.rsplit(":", 1)

                try:
                    peers.append((ip, int(port)))
                except ValueError:
                    logger.debug("Invalid peer address", addr=addr)
                    pass

        # Get manually added nodes
        try:
            added_nodes = await self.getaddednodeinfo()
            for node in added_nodes:
                if node.get("connected"):
                    for addr_info in node.get("addresses", []):
                        addr = addr_info.get("address", "")
                        if ":" in addr:
                            if addr.startswith("["):
                                ip, port = addr.rsplit("]:", 1)
                                ip = ip[1:]
                            else:
                                ip, port = addr.rsplit(":", 1)

                            try:
                                peers.append((ip, int(port)))
                            except ValueError:
                                pass
        except Exception as e:
            logger.debug("Failed to get added nodes", error=str(e))

        # Deduplicate
        unique_peers = list(set(peers))
        logger.info("Retrieved peers from RPC", count=len(unique_peers))
        return unique_peers

    async def test_connection(self) -> bool:
        """
        Test if RPC connection is working.

        Returns:
            True if connection successful
        """
        try:
            count = await self.getconnectioncount()
            logger.info("RPC connection test successful", connections=count)
            return True
        except Exception as e:
            logger.error("RPC connection test failed", error=str(e))
            return False

    async def get_local_node_info(self) -> Optional[Dict]:
        """
        Get information about the local RPC node itself.

        This is used to mark the RPC node as "up" since we know it's online
        (we're talking to it via RPC right now).

        Returns:
            Dictionary with:
            - local_addresses: List of (ip, port) tuples
            - version: Protocol version
            - subversion: User agent string
            - connections: Number of connections
        """
        try:
            network_info = await self.getnetworkinfo()
            if not network_info:
                return None

            local_addresses = []
            for addr in network_info.get("localaddresses", []):
                ip = addr.get("address")
                port = addr.get("port")
                if ip and port:
                    local_addresses.append((ip, port))

            return {
                "local_addresses": local_addresses,
                "version": network_info.get("protocolversion"),
                "subversion": network_info.get("subversion", ""),
                "connections": network_info.get("connections", 0),
            }
        except Exception as e:
            logger.warning("Failed to get local node info", error=str(e))
            return None
