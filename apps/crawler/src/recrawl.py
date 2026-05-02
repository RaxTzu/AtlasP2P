"""Pure (dependency-free) re-crawl cadence helper.

Lives in its own module so it can be unit-tested without pulling in supabase,
structlog, or the rest of the crawler runtime.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional


def should_recrawl(
    status: Optional[str],
    last_seen: Optional[datetime],
    last_handshake_at: Optional[datetime],
    now: datetime,
    stale_reachable_after_hours: int,
    down_recheck_minutes: int = 30,
    other_recheck_minutes: int = 10,
) -> bool:
    """Decide whether a node from the DB should be re-crawled this pass.

    Cadence rules:
      - "up": every pass (hot path).
      - "reachable" with a recent successful handshake: every pass — treat as
        a flapping legitimate peer.
      - "reachable" with a stale (or never) handshake: every
        ``down_recheck_minutes`` — same as ``down``. Self-healing: a successful
        handshake on the next slow check promotes it back to fast cadence.
      - "down": every ``down_recheck_minutes``.
      - Everything else (pending/unknown): every ``other_recheck_minutes``.
      - Missing ``last_seen``: always crawl.
    """
    if last_seen is None:
        return True
    minutes_since = (now - last_seen).total_seconds() / 60.0

    if status == "up":
        return True
    if status == "reachable":
        if last_handshake_at is not None:
            hours_since_handshake = (now - last_handshake_at).total_seconds() / 3600.0
            if hours_since_handshake <= stale_reachable_after_hours:
                return True
        return minutes_since > down_recheck_minutes
    if status == "down":
        return minutes_since > down_recheck_minutes
    return minutes_since > other_recheck_minutes
