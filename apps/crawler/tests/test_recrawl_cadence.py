"""Pure-function tests for crawler's re-crawl cadence decision.

No DB, no network, no asyncio — just the should_recrawl() decision table.
Run with: python3 -m unittest apps.crawler.tests.test_recrawl_cadence
or with pytest: pytest apps/crawler/tests/test_recrawl_cadence.py
"""
from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow running directly without install; test imports the source module.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.recrawl import should_recrawl  # noqa: E402


NOW = datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc)
STALE_HOURS = 24


def _ago(**kwargs) -> datetime:
    return NOW - timedelta(**kwargs)


class ShouldRecrawlTests(unittest.TestCase):
    # --- "up": always re-crawl, regardless of timestamps ----------------

    def test_up_always_recrawls_even_if_just_seen(self):
        self.assertTrue(
            should_recrawl(
                status="up",
                last_seen=_ago(seconds=10),
                last_handshake_at=_ago(seconds=10),
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_up_recrawls_when_handshake_unknown(self):
        # Defensive: status=up + no handshake timestamp (shouldn't happen in
        # practice post-migration, but must not skip the node).
        self.assertTrue(
            should_recrawl(
                status="up",
                last_seen=_ago(minutes=2),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    # --- "reachable" with recent handshake: fast cadence ---------------

    def test_reachable_recent_handshake_recrawls(self):
        self.assertTrue(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=2),
                last_handshake_at=_ago(hours=1),
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_reachable_handshake_at_boundary_recrawls(self):
        # Handshake exactly at the window edge stays on fast cadence.
        self.assertTrue(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=2),
                last_handshake_at=_ago(hours=STALE_HOURS),
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    # --- "reachable" stale: slow cadence -------------------------------

    def test_reachable_stale_handshake_skips_within_window(self):
        # Handshake older than threshold + last_seen recent → fall to slow.
        self.assertFalse(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=2),
                last_handshake_at=_ago(hours=STALE_HOURS + 1),
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_reachable_stale_handshake_recrawls_after_30min(self):
        self.assertTrue(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=31),
                last_handshake_at=_ago(hours=48),
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_reachable_handshake_never_treated_as_stale(self):
        # No handshake on record → treat as cold → slow cadence.
        self.assertFalse(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=2),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )
        # …but still re-crawls once the slow window elapses.
        self.assertTrue(
            should_recrawl(
                status="reachable",
                last_seen=_ago(minutes=31),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    # --- "down": slow cadence (unchanged from prior behavior) ----------

    def test_down_skips_within_30min(self):
        self.assertFalse(
            should_recrawl(
                status="down",
                last_seen=_ago(minutes=10),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_down_recrawls_after_30min(self):
        self.assertTrue(
            should_recrawl(
                status="down",
                last_seen=_ago(minutes=31),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    # --- unknown / pending: 10-minute cadence --------------------------

    def test_unknown_skips_within_10min(self):
        self.assertFalse(
            should_recrawl(
                status="pending",
                last_seen=_ago(minutes=5),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    def test_unknown_recrawls_after_10min(self):
        self.assertTrue(
            should_recrawl(
                status=None,
                last_seen=_ago(minutes=11),
                last_handshake_at=None,
                now=NOW,
                stale_reachable_after_hours=STALE_HOURS,
            )
        )

    # --- missing last_seen: always crawl -------------------------------

    def test_missing_last_seen_always_recrawls(self):
        for status in ("up", "reachable", "down", "pending", None):
            with self.subTest(status=status):
                self.assertTrue(
                    should_recrawl(
                        status=status,
                        last_seen=None,
                        last_handshake_at=None,
                        now=NOW,
                        stale_reachable_after_hours=STALE_HOURS,
                    )
                )


if __name__ == "__main__":
    unittest.main()
