"""Layer 2 — System Memory: extracts and stores key facts, preferences, decisions, goals."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.models import MemoryRecord, MemoryCategory
from app.db.database import db
from app.db.vector_store import vector_store

logger = logging.getLogger(__name__)

# Prompt used to extract important information from a conversation turn.
EXTRACTION_PROMPT = """Analyse the following conversation exchange and extract any important information.
Return a JSON array of objects. Each object must have:
- "category": one of "fact", "preference", "decision", "goal", "summary"
- "content": a concise statement of the information
- "importance": a float 0-1 indicating how important this is to remember

Only include genuinely important, non-trivial information. If there is nothing worth remembering, return an empty array [].

Conversation:
User: {user_message}
Assistant: {assistant_message}

Return ONLY the JSON array, no markdown fences, no extra text."""


class SystemMemory:
    """Extracts key facts from conversations and stores them for later retrieval.

    Uses SQLite for structured storage and FAISS for semantic search.
    An LLM call is used to extract important information after each turn.
    """

    # ── extraction ────────────────────────────────────────────────────────

    async def extract_and_store(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        source_message_id: str,
        llm_call,
    ) -> list[MemoryRecord]:
        """Use the LLM to extract important info and persist it.

        *llm_call* is an async callable:  ``(prompt: str) -> str``
        """
        prompt = EXTRACTION_PROMPT.format(
            user_message=user_message,
            assistant_message=assistant_message,
        )
        try:
            raw = await llm_call(prompt)
            # Strip markdown fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            items = json.loads(raw)
        except Exception as e:
            logger.warning("SystemMemory extraction failed: %s", e)
            return []

        records: list[MemoryRecord] = []
        for item in items:
            if not isinstance(item, dict) or "content" not in item:
                continue
            try:
                cat = MemoryCategory(item.get("category", "fact"))
            except ValueError:
                cat = MemoryCategory.FACT

            rec = MemoryRecord(
                session_id=session_id,
                category=cat,
                content=item["content"],
                source_message_id=source_message_id,
                importance=float(item.get("importance", 0.5)),
            )
            # Persist to SQLite
            await db.insert_system_memory(
                id=rec.id,
                session_id=rec.session_id,
                category=rec.category.value,
                content=rec.content,
                source_message_id=rec.source_message_id,
                importance=rec.importance,
                created_at=rec.created_at,
            )
            # Add to FAISS for semantic search
            await vector_store.add_text(
                rec.content,
                metadata={"type": "system_memory", "category": rec.category.value, "id": rec.id},
            )
            records.append(rec)

        if records:
            logger.info("SystemMemory: extracted %d memories for session %s", len(records), session_id)
        return records

    # ── retrieval ─────────────────────────────────────────────────────────

    async def search_relevant(
        self, query: str, session_id: str | None = None, k: int = 5
    ) -> list[dict[str, Any]]:
        """Semantic search over system memories using FAISS."""
        results = await vector_store.search(query, k=k * 2)
        # Filter to system_memory type
        filtered = [r for r in results if r.get("metadata", {}).get("type") == "system_memory"]
        return filtered[:k]

    async def get_all(self, session_id: str | None = None) -> list[MemoryRecord]:
        """Return all system memories, optionally filtered by session."""
        rows = await db.get_system_memories(session_id=session_id)
        return [
            MemoryRecord(
                id=r["id"],
                session_id=r["session_id"],
                category=MemoryCategory(r["category"]),
                content=r["content"],
                source_message_id=r.get("source_message_id", ""),
                importance=r.get("importance", 0.5),
                created_at=r.get("created_at", 0),
            )
            for r in rows
        ]

    async def get_by_category(self, session_id: str, category: MemoryCategory) -> list[MemoryRecord]:
        rows = await db.get_system_memories(session_id=session_id, category=category.value)
        return [
            MemoryRecord(
                id=r["id"],
                session_id=r["session_id"],
                category=MemoryCategory(r["category"]),
                content=r["content"],
                source_message_id=r.get("source_message_id", ""),
                importance=r.get("importance", 0.5),
                created_at=r.get("created_at", 0),
            )
            for r in rows
        ]

    async def get_context_string(self, session_id: str, query: str = "", limit: int = 10) -> str:
        """Return relevant system memories formatted as context text."""
        if query:
            results = await self.search_relevant(query, session_id=session_id, k=limit)
            if results:
                lines = [f"- [{r['metadata'].get('category', 'fact')}] {r['text']}" for r in results]
                return "Known facts and preferences:\n" + "\n".join(lines)

        # Fallback: return most important memories
        all_mems = await self.get_all(session_id)
        if not all_mems:
            return "(No stored facts or preferences.)"
        sorted_mems = sorted(all_mems, key=lambda m: m.importance, reverse=True)[:limit]
        lines = [f"- [{m.category.value}] {m.content}" for m in sorted_mems]
        return "Known facts and preferences:\n" + "\n".join(lines)


# ── Singleton ─────────────────────────────────────────────────────────────────
system_memory = SystemMemory()
