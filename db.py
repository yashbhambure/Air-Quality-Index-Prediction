"""SQLite persistence layer for AQI prediction history.

Schema
------
predictions(id INTEGER PK, timestamp TEXT, inputs TEXT, result TEXT)

- ``inputs``  → JSON-encoded dict of feature columns
- ``result``  → JSON-encoded AQI prediction result from AQIPredictor

All reads/writes go through module-level helpers so the rest of the app
never needs to know about SQL.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any

logger = logging.getLogger("db")

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "models" / "history.db"
_MAX_ROWS = 500  # hard cap; oldest rows are pruned automatically


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Configure SQLite for high concurrency and resilience
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=30000;")
    except sqlite3.Error as exc:
        logger.warning("[Database] Failed to set SQLite PRAGMA pragmas: %s", exc)
    return conn


def init_db() -> bool:
    """Create the predictions table and configure WAL mode if not already initialized."""
    try:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS predictions (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT    NOT NULL,
                    inputs    TEXT    NOT NULL,
                    result    TEXT    NOT NULL
                )
                """
            )
            conn.commit()
        return True
    except Exception as exc:
        logger.exception("[Database] Failed to initialise SQLite history database: %s", exc)
        return False


def is_db_ready() -> bool:
    """Check if the SQLite database is reachable and table exists."""
    try:
        if not DB_PATH.exists():
            return False
        with _connect() as conn:
            cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='predictions';")
            return cur.fetchone() is not None
    except Exception:
        return False


def insert_prediction(timestamp: str, inputs: dict[str, Any], result: dict[str, Any]) -> bool:
    """Persist one prediction record and prune rows beyond *_MAX_ROWS*.

    Returns True if successfully written, False if persistence failed.
    Never throws an unhandled exception to the caller.
    """
    try:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO predictions (timestamp, inputs, result) VALUES (?, ?, ?)",
                (timestamp, json.dumps(inputs), json.dumps(result)),
            )
            # Keep the table bounded — delete oldest rows beyond the cap
            conn.execute(
                """
                DELETE FROM predictions
                WHERE id NOT IN (
                    SELECT id FROM predictions ORDER BY id DESC LIMIT ?
                )
                """,
                (_MAX_ROWS,),
            )
            conn.commit()
        return True
    except Exception as exc:
        logger.warning("[History] Persistence failed (non-critical): %s", exc)
        return False


def fetch_history(limit: int = 50) -> list[dict[str, Any]]:
    """Return the *limit* most recent predictions, newest first."""
    try:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT timestamp, inputs, result FROM predictions ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()

        records: list[dict[str, Any]] = []
        for row in rows:
            try:
                records.append(
                    {
                        "timestamp": row["timestamp"],
                        "inputs": json.loads(row["inputs"]),
                        "result": json.loads(row["result"]),
                    }
                )
            except (json.JSONDecodeError, KeyError) as parse_exc:
                logger.warning("[History] Corrupt history record skipped: %s", parse_exc)
        return records
    except Exception as exc:
        logger.warning("[History] Failed to fetch prediction history: %s", exc)
        return []

