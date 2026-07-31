"""Layer 1 — Chat Memory: full conversation history per session."""
from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage

from app.core.models import ChatMessage, MessageRole
from app.db.database import db

logger = logging.getLogger(__name__)


class ChatMemory:
    """Stores and retrieves the complete conversation history for a session.

    Every user and assistant message is persisted to SQLite so history
    survives server restarts.  The class also converts rows into LangChain
    message objects ready for the LLM.
    """

    # ── write ─────────────────────────────────────────────────────────────

    async def add_message(self, msg: ChatMessage) -> None:
        """Persist a single message."""
        await db.insert_chat_message(
            id=msg.id,
            session_id=msg.session_id,
            role=msg.role.value,
            content=msg.content,
            timestamp=msg.timestamp,
        )
        logger.debug("ChatMemory: stored %s message [%s]", msg.role.value, msg.id)

    async def add_user_message(self, session_id: str, content: str, msg_id: str = "") -> ChatMessage:
        msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.USER,
            content=content,
            **({"id": msg_id} if msg_id else {}),
        )
        await self.add_message(msg)
        return msg

    async def add_assistant_message(self, session_id: str, content: str, msg_id: str = "") -> ChatMessage:
        msg = ChatMessage(
            session_id=session_id,
            role=MessageRole.ASSISTANT,
            content=content,
            **({"id": msg_id} if msg_id else {}),
        )
        await self.add_message(msg)
        return msg

    # ── read ──────────────────────────────────────────────────────────────

    async def get_history(self, session_id: str, limit: int = 100) -> list[ChatMessage]:
        """Return full ordered conversation history."""
        rows = await db.get_chat_history(session_id, limit=limit)
        return [
            ChatMessage(
                id=r["id"],
                session_id=r["session_id"],
                role=MessageRole(r["role"]),
                content=r["content"],
                timestamp=r["timestamp"],
            )
            for r in rows
        ]

    async def get_recent(self, session_id: str, n: int = 10) -> list[ChatMessage]:
        """Return the last *n* messages (useful for quick context)."""
        all_msgs = await self.get_history(session_id, limit=n)
        return all_msgs[-n:]

    async def get_langchain_messages(self, session_id: str, limit: int = 50) -> list[BaseMessage]:
        """Return history as LangChain message objects."""
        history = await self.get_history(session_id, limit=limit)
        lc_msgs: list[BaseMessage] = []
        for m in history:
            if m.role == MessageRole.USER:
                lc_msgs.append(HumanMessage(content=m.content))
            elif m.role == MessageRole.ASSISTANT:
                lc_msgs.append(AIMessage(content=m.content))
            else:
                lc_msgs.append(SystemMessage(content=m.content))
        return lc_msgs

    async def get_context_string(self, session_id: str, limit: int = 20) -> str:
        """Return conversation history as a formatted string for context injection."""
        history = await self.get_recent(session_id, n=limit)
        if not history:
            return "(No conversation history yet.)"
        lines = []
        for m in history:
            role = "User" if m.role == MessageRole.USER else "Assistant"
            lines.append(f"{role}: {m.content}")
        return "\n".join(lines)


# ── Singleton ─────────────────────────────────────────────────────────────────
chat_memory = ChatMemory()
