"""SQLite observation log.

This is the server's memory: a tiny table that records, per tracking id, when we
first/last saw the browser, how many times it has visited, and which vectors it
was recovered from on the most recent visit. It is what lets the site say
"we've seen this browser 7 times since March" even after you clear your cookies.
"""

import json
import sqlite3
import threading
import zlib
from datetime import datetime, timezone

from . import config


def lastmod_token(id: str) -> int:
    """Deterministic 32-bit token for the Last-Modified vector.

    A Last-Modified header can only carry an HTTP date (≈32 usable bits), not a
    full 128-bit id, so we map the id to a 32-bit value and store the reverse
    lookup. crc32 is a fast, stable, non-cryptographic hash — collisions are ~1
    in 4 billion, which is fine for a demo (last writer wins).
    """
    return zlib.crc32(id.encode()) & 0xFFFFFFFF

# SQLite is happy with one writer; a process-wide lock keeps the demo simple and
# avoids "database is locked" under concurrent requests.
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _connect() -> sqlite3.Connection:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    """Create the table if it does not exist (called on startup)."""
    with _lock:
        conn = _connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS browsers (
                    id              TEXT PRIMARY KEY,
                    first_seen      TEXT NOT NULL,
                    last_seen       TEXT NOT NULL,
                    visit_count     INTEGER NOT NULL DEFAULT 1,
                    last_recovered  TEXT,
                    lastmod_token   INTEGER
                )
                """
            )
            _ensure_columns(conn)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_browsers_lastmod ON browsers (lastmod_token)")
            conn.commit()
        finally:
            conn.close()


def _ensure_columns(conn: sqlite3.Connection) -> None:
    """Lightweight migration: add columns introduced after the first release."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(browsers)")}
    if "lastmod_token" not in existing:
        conn.execute("ALTER TABLE browsers ADD COLUMN lastmod_token INTEGER")


def record_visit(id: str, recovered_from: list[str]) -> dict:
    """Upsert a browser record for ``id`` and return its current state."""
    now = _now()
    recovered = json.dumps(recovered_from)
    token = lastmod_token(id)
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM browsers WHERE id = ?", (id,)).fetchone()
            if row is None:
                conn.execute(
                    "INSERT INTO browsers (id, first_seen, last_seen, visit_count, last_recovered, lastmod_token)"
                    " VALUES (?, ?, ?, 1, ?, ?)",
                    (id, now, now, recovered, token),
                )
                first_seen, visit_count, is_new = now, 1, True
            else:
                first_seen = row["first_seen"]
                visit_count = row["visit_count"] + 1
                is_new = False
                conn.execute(
                    "UPDATE browsers SET last_seen = ?, visit_count = ?, last_recovered = ?, lastmod_token = ?"
                    " WHERE id = ?",
                    (now, visit_count, recovered, token, id),
                )
            conn.commit()
        finally:
            conn.close()
    return {
        "id": id,
        "first_seen": first_seen,
        "last_seen": now,
        "visit_count": visit_count,
        "is_new": is_new,
        "recovered_from": recovered_from,
    }


def get(id: str) -> dict | None:
    """Return the stored record for ``id``, or ``None``."""
    with _lock:
        conn = _connect()
        try:
            row = conn.execute("SELECT * FROM browsers WHERE id = ?", (id,)).fetchone()
        finally:
            conn.close()
    if row is None:
        return None
    record = dict(row)
    record.pop("user_agent", None)
    record["last_recovered"] = json.loads(record["last_recovered"]) if record["last_recovered"] else []
    return record


def forget(id: str) -> bool:
    """Delete the record for ``id``. Returns True if a row was removed."""
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("DELETE FROM browsers WHERE id = ?", (id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def find_by_lastmod_token(token: int) -> str | None:
    """Reverse the Last-Modified token back to a browser id (most recent wins)."""
    with _lock:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT id FROM browsers WHERE lastmod_token = ? ORDER BY last_seen DESC LIMIT 1",
                (token,),
            ).fetchone()
        finally:
            conn.close()
    return row["id"] if row else None


def total_browsers() -> int:
    """How many distinct browsers we've ever recorded."""
    with _lock:
        conn = _connect()
        try:
            return conn.execute("SELECT COUNT(*) AS n FROM browsers").fetchone()["n"]
        finally:
            conn.close()
