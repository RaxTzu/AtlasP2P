"""
Database Service

Handles storing crawler data in Supabase (PostgreSQL).
"""

from typing import Dict, Optional
from datetime import datetime
import structlog

try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False

logger = structlog.get_logger()


class Database:
    """Database service for storing node data."""

    def __init__(self, url: str, key: str, chain: str):
        self.chain = chain
        self.client: Optional[Client] = None

        if HAS_SUPABASE and url and key:
            try:
                self.client = create_client(url, key)
                logger.info("Supabase client initialized")
            except Exception as e:
                logger.error("Failed to initialize Supabase", error=str(e))
        else:
            if not HAS_SUPABASE:
                logger.warning("supabase library not installed")
            else:
                logger.warning("Supabase credentials not provided")

    async def upsert_node(self, node_data: Dict) -> Optional[str]:
        """
        Insert or update a node in the database.

        Uses upsert with conflict on (ip, port, chain).
        Returns the node_id (UUID) if successful, None otherwise.
        """
        if not self.client:
            logger.debug("No database client, skipping save")
            return None

        try:
            # Convert IP to string format for Supabase
            data = {
                **node_data,
                "updated_at": datetime.utcnow().isoformat(),
            }

            # Upsert to nodes table and return the node_id
            result = self.client.table("nodes").upsert(
                data,
                on_conflict="ip,port,chain",
            ).execute()

            # Extract node_id from result
            if result.data and len(result.data) > 0:
                return result.data[0].get("id")

            return None

        except Exception as e:
            logger.error("Failed to upsert node", error=str(e))
            return None

    async def create_node_snapshot(
        self,
        node_id: str,
        is_online: bool,
        response_time_ms: Optional[float],
        block_height: Optional[int]
    ) -> bool:
        """
        Create a snapshot entry for node uptime tracking.

        Args:
            node_id: UUID of the node
            is_online: Whether the node responded successfully
            response_time_ms: Latency in milliseconds (None if offline)
            block_height: Current blockchain height (None if offline)

        Returns:
            True if snapshot was created successfully
        """
        if not self.client:
            return False

        try:
            data = {
                "node_id": node_id,
                "snapshot_time": datetime.utcnow().isoformat(),
                "is_online": is_online,
                "response_time_ms": response_time_ms,
                "block_height": block_height,
            }

            self.client.table("node_snapshots").insert(data).execute()
            return True

        except Exception as e:
            logger.debug("Failed to create node snapshot", node_id=node_id, error=str(e))
            return False

    async def get_node(self, ip: str, port: int) -> Optional[Dict]:
        """Get a node by IP and port."""
        if not self.client:
            return None

        try:
            result = self.client.table("nodes").select("*").eq(
                "ip", ip
            ).eq(
                "port", port
            ).eq(
                "chain", self.chain
            ).single().execute()

            return result.data

        except Exception as e:
            logger.debug("Failed to get node", ip=ip, port=port, error=str(e))
            return None

    async def get_all_nodes(self) -> list:
        """Get all nodes for this chain."""
        if not self.client:
            logger.warning("No Supabase client available")
            return []

        try:
            logger.debug("Fetching nodes from database", chain=self.chain)
            result = self.client.table("nodes").select("*").eq(
                "chain", self.chain
            ).execute()

            nodes = result.data or []
            logger.debug("Fetched nodes from database", count=len(nodes))
            return nodes

        except Exception as e:
            logger.error("Failed to get nodes", error=str(e), chain=self.chain)
            return []

    async def prune_stale_nodes(self, hours: int = 24) -> int:
        """Remove nodes not seen in the specified hours."""
        if not self.client:
            return 0

        try:
            from datetime import timedelta
            cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

            result = self.client.table("nodes").delete().eq(
                "chain", self.chain
            ).lt(
                "last_seen", cutoff
            ).execute()

            count = len(result.data) if result.data else 0
            logger.info("Pruned stale nodes", count=count, hours=hours)
            return count

        except Exception as e:
            logger.error("Failed to prune nodes", error=str(e))
            return 0

    async def save_snapshot(self, stats: Dict) -> bool:
        """Save a network snapshot."""
        if not self.client:
            return False

        try:
            data = {
                "chain": self.chain,
                "timestamp": datetime.utcnow().isoformat(),
                "total_nodes": stats.get("total_nodes", 0),
                "reachable_nodes": stats.get("reachable_nodes", 0),
                "block_height": stats.get("block_height"),
                "stats": stats,
            }

            result = self.client.table("snapshots").insert(data).execute()

            logger.info("Snapshot saved", chain=self.chain)
            return True

        except Exception as e:
            logger.error("Failed to save snapshot", error=str(e))
            return False

    async def update_node_history(self, node_id: str, status: str, latency_ms: Optional[float], block_height: Optional[int]) -> bool:
        """Add an entry to node history for tracking uptime."""
        if not self.client:
            return False

        try:
            data = {
                "node_id": node_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status": status,
                "latency_ms": latency_ms,
                "block_height": block_height,
            }

            result = self.client.table("node_history").insert(data).execute()
            return True

        except Exception as e:
            logger.debug("Failed to update node history", error=str(e))
            return False

    async def trigger_alert_processing(self, web_url: str, api_key: Optional[str] = None) -> bool:
        """
        Trigger the alert processing API endpoint after a crawl pass.

        Args:
            web_url: Base URL of the web app (e.g., http://localhost:4000)
            api_key: Optional API key for authentication

        Returns:
            True if alerts were processed successfully
        """
        import aiohttp

        try:
            url = f"{web_url}/api/alerts/process"
            headers = {"Content-Type": "application/json"}

            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json={"checkMinutes": 10},
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(
                            "Alert processing completed",
                            processed=result.get("processed", 0),
                            sent=result.get("sent", 0)
                        )
                        return True
                    else:
                        text = await response.text()
                        logger.warning("Alert processing failed", status=response.status, response=text)
                        return False

        except Exception as e:
            logger.error("Failed to trigger alert processing", error=str(e))
            return False

    async def create_network_snapshot(self) -> Optional[Dict]:
        """
        Create network snapshot for historical tracking.

        Only creates if >55 minutes since last snapshot (automatic deduplication).
        Called automatically after each successful crawl pass.

        Returns:
            Dict with snapshot data if created, None if duplicate prevented or error
        """
        if not self.client:
            logger.debug("No database client, skipping snapshot")
            return None

        try:
            # Call PostgreSQL function (handles deduplication logic)
            result = self.client.rpc(
                'save_network_snapshot',
                {'p_chain': self.chain}
            ).execute()

            if result.data and len(result.data) > 0:
                snapshot = result.data[0]
                logger.info(
                    "Network snapshot created",
                    chain=self.chain,
                    total_nodes=snapshot['total_nodes_count'],
                    online_nodes=snapshot['online_nodes_count'],
                    timestamp=snapshot['snapshot_ts']
                )
                return snapshot
            else:
                logger.debug("Snapshot skipped (created recently)", chain=self.chain)
                return None

        except Exception as e:
            logger.warning("Failed to create network snapshot", chain=self.chain, error=str(e))
            return None
