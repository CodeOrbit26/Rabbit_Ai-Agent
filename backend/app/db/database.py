"""Async SQLite database manager with table creation and CRUD operations."""
from __future__ import annotations

import json
import aiosqlite
from pathlib import Path
from typing import Any

from app.core.config import settings


class Database:
    """Thin async wrapper around SQLite for all persistent storage."""

    def __init__(self) -> None:
        self._db_path = settings.db_full_path
        self._conn: aiosqlite.Connection | None = None

    # ── lifecycle ─────────────────────────────────────────────────────────

    async def connect(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = await aiosqlite.connect(str(self._db_path))
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._create_tables()

    async def close(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._conn

    # ── table creation ────────────────────────────────────────────────────

    async def _create_tables(self) -> None:
        await self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                timestamp   REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chat_session
                ON chat_messages(session_id, timestamp);

            CREATE TABLE IF NOT EXISTS system_memories (
                id                TEXT PRIMARY KEY,
                session_id        TEXT NOT NULL,
                category          TEXT NOT NULL,
                content           TEXT NOT NULL,
                source_message_id TEXT DEFAULT '',
                importance        REAL DEFAULT 0.5,
                created_at        REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sysmem_session
                ON system_memories(session_id);

            CREATE TABLE IF NOT EXISTS topic_memories (
                id              TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                topic           TEXT NOT NULL,
                summary         TEXT DEFAULT '',
                frequency       INTEGER DEFAULT 1,
                first_discussed REAL NOT NULL,
                last_discussed  REAL NOT NULL,
                related_topics  TEXT DEFAULT '[]',
                outcomes        TEXT DEFAULT '[]'
            );
            CREATE INDEX IF NOT EXISTS idx_topic_session
                ON topic_memories(session_id);

            CREATE TABLE IF NOT EXISTS workflow_states (
                workflow_id TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL,
                state_json  TEXT NOT NULL,
                node        TEXT DEFAULT '',
                created_at  REAL NOT NULL,
                updated_at  REAL NOT NULL
            );
        """)
        await self.conn.commit()

    # ── chat messages ─────────────────────────────────────────────────────

    async def insert_chat_message(
        self, id: str, session_id: str, role: str, content: str, timestamp: float
    ) -> None:
        await self.conn.execute(
            "INSERT OR REPLACE INTO chat_messages (id, session_id, role, content, timestamp) "
            "VALUES (?, ?, ?, ?, ?)",
            (id, session_id, role, content, timestamp),
        )
        await self.conn.commit()

    async def get_chat_history(
        self, session_id: str, limit: int = 100
    ) -> list[dict[str, Any]]:
        cursor = await self.conn.execute(
            "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?",
            (session_id, limit),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_all_sessions(self) -> list[dict[str, Any]]:
        cursor = await self.conn.execute(
            "SELECT session_id, MIN(timestamp) as started, MAX(timestamp) as last_active, "
            "COUNT(*) as message_count "
            "FROM chat_messages GROUP BY session_id ORDER BY last_active DESC"
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    # ── system memories ───────────────────────────────────────────────────

    async def insert_system_memory(
        self,
        id: str,
        session_id: str,
        category: str,
        content: str,
        source_message_id: str,
        importance: float,
        created_at: float,
    ) -> None:
        await self.conn.execute(
            "INSERT OR REPLACE INTO system_memories "
            "(id, session_id, category, content, source_message_id, importance, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (id, session_id, category, content, source_message_id, importance, created_at),
        )
        await self.conn.commit()

    async def get_system_memories(
        self, session_id: str | None = None, category: str | None = None
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM system_memories WHERE 1=1"
        params: list[Any] = []
        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)
        if category:
            query += " AND category = ?"
            params.append(category)
        query += " ORDER BY importance DESC, created_at DESC"
        cursor = await self.conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    # ── topic memories ────────────────────────────────────────────────────

    async def upsert_topic(
        self,
        id: str,
        session_id: str,
        topic: str,
        summary: str,
        frequency: int,
        first_discussed: float,
        last_discussed: float,
        related_topics: list[str],
        outcomes: list[str],
    ) -> None:
        await self.conn.execute(
            "INSERT OR REPLACE INTO topic_memories "
            "(id, session_id, topic, summary, frequency, first_discussed, "
            "last_discussed, related_topics, outcomes) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                id, session_id, topic, summary, frequency,
                first_discussed, last_discussed,
                json.dumps(related_topics), json.dumps(outcomes),
            ),
        )
        await self.conn.commit()

    async def get_topics(self, session_id: str | None = None) -> list[dict[str, Any]]:
        if session_id:
            cursor = await self.conn.execute(
                "SELECT * FROM topic_memories WHERE session_id = ? ORDER BY last_discussed DESC",
                (session_id,),
            )
        else:
            cursor = await self.conn.execute(
                "SELECT * FROM topic_memories ORDER BY last_discussed DESC"
            )
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["related_topics"] = json.loads(d.get("related_topics", "[]"))
            d["outcomes"] = json.loads(d.get("outcomes", "[]"))
            results.append(d)
        return results

    async def find_topic_by_name(self, session_id: str, topic: str) -> dict[str, Any] | None:
        cursor = await self.conn.execute(
            "SELECT * FROM topic_memories WHERE session_id = ? AND topic = ?",
            (session_id, topic),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        d = dict(row)
        d["related_topics"] = json.loads(d.get("related_topics", "[]"))
        d["outcomes"] = json.loads(d.get("outcomes", "[]"))
        return d

    # ── workflow states ───────────────────────────────────────────────────

    async def save_workflow_state(
        self, workflow_id: str, session_id: str, state_json: str, node: str, created_at: float, updated_at: float
    ) -> None:
        await self.conn.execute(
            "INSERT OR REPLACE INTO workflow_states "
            "(workflow_id, session_id, state_json, node, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (workflow_id, session_id, state_json, node, created_at, updated_at),
        )
        await self.conn.commit()

    async def get_workflow_state(self, workflow_id: str) -> dict[str, Any] | None:
        cursor = await self.conn.execute(
            "SELECT * FROM workflow_states WHERE workflow_id = ?", (workflow_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def delete_workflow_state(self, workflow_id: str) -> None:
        await self.conn.execute(
            "DELETE FROM workflow_states WHERE workflow_id = ?", (workflow_id,)
        )
        await self.conn.commit()


# ── Singleton ─────────────────────────────────────────────────────────────────
db = Database()
