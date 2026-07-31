"""Unified memory interface — connects all 3 memory layers."""
from __future__ import annotations

import logging
from typing import Any

from app.memory.chat_memory import chat_memory, ChatMemory
from app.memory.system_memory import system_memory, SystemMemory
from app.memory.relationship_memory import relationship_memory, RelationshipMemory

logger = logging.getLogger(__name__)


class MemoryManager:
    """Single entry-point for the LangGraph nodes to interact with memory.

    Orchestrates cross-layer queries and updates so that individual nodes
    don't need to know about the internal structure of each memory layer.
    """

    def __init__(self) -> None:
        self.chat: ChatMemory = chat_memory
        self.system: SystemMemory = system_memory
        self.relationship: RelationshipMemory = relationship_memory

    # ── unified retrieval ─────────────────────────────────────────────────

    async def retrieve_full_context(self, session_id: str, user_query: str) -> dict[str, str]:
        """Retrieve context from ALL memory layers in parallel with zero-latency lookups."""
        import asyncio

        # Fast parallel retrieval without blocking vector store searches
        chat_fut = self.chat.get_context_string(session_id, limit=6)
        sys_fut = self.system.get_context_string(session_id, query="", limit=5)
        topic_fut = self.relationship.get_context_string(session_id, query="", limit=5)

        chat_ctx, system_ctx, topic_ctx = await asyncio.gather(chat_fut, sys_fut, topic_fut)

        return {
            "chat_history": chat_ctx,
            "system_context": system_ctx,
            "topic_context": topic_ctx,
        }

    async def build_enriched_prompt(self, session_id: str, user_query: str) -> str:
        """Build a single enriched context string from all memory layers."""
        ctx = await self.retrieve_full_context(session_id, user_query)

        parts = []
        if ctx["system_context"] and "No stored" not in ctx["system_context"]:
            parts.append(f"## What I Know About the User\n{ctx['system_context']}")
        if ctx["topic_context"] and "No previous" not in ctx["topic_context"]:
            parts.append(f"## Previous Discussions\n{ctx['topic_context']}")
        if ctx["chat_history"] and "No conversation" not in ctx["chat_history"]:
            parts.append(f"## Recent Conversation\n{ctx['chat_history']}")

        if not parts:
            return ""
        return "\n\n".join(parts)

    # ── unified update ────────────────────────────────────────────────────

    async def update_all_memories(
        self,
        session_id: str,
        user_message: str,
        assistant_message: str,
        user_msg_id: str,
        assistant_msg_id: str,
        llm_call,
    ) -> dict[str, int]:
        """After a conversation turn, update all memory layers.

        1. Chat history is already stored when messages are created.
        2. Extract and store system memories (facts, preferences, etc.)
        3. Track topics in relationship memory.

        *llm_call* is ``async (prompt: str) -> str``.

        Returns counts of memories/topics created.
        """
        # System memory extraction
        try:
            sys_records = await self.system.extract_and_store(
                session_id=session_id,
                user_message=user_message,
                assistant_message=assistant_message,
                source_message_id=user_msg_id,
                llm_call=llm_call,
            )
        except Exception as e:
            logger.error("SystemMemory update failed: %s", e)
            sys_records = []

        # Topic tracking
        try:
            topic_records = await self.relationship.track_topics(
                session_id=session_id,
                user_message=user_message,
                assistant_message=assistant_message,
                llm_call=llm_call,
            )
        except Exception as e:
            logger.error("RelationshipMemory update failed: %s", e)
            topic_records = []

        result = {
            "memories_created": len(sys_records),
            "topics_tracked": len(topic_records),
        }
        logger.info("MemoryManager update: %s", result)
        return result

    # ── stats ─────────────────────────────────────────────────────────────

    async def get_stats(self, session_id: str | None = None) -> dict[str, Any]:
        """Return counts/stats for all memory layers."""
        all_sys = await self.system.get_all(session_id)
        all_topics = await self.relationship.get_all_topics(session_id or "default")
        return {
            "system_memories": len(all_sys),
            "topics_tracked": len(all_topics),
            "top_topics": [t.topic for t in all_topics[:5]],
        }


# ── Singleton ─────────────────────────────────────────────────────────────────
memory_manager = MemoryManager()
