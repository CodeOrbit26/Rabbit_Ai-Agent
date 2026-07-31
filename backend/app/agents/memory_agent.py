"""Memory Agent — retrieves relevant memories from all 3 layers."""
from __future__ import annotations

import logging
from typing import Any

from app.agents.base_agent import BaseAgent
from app.memory.memory_manager import memory_manager

logger = logging.getLogger(__name__)


class MemoryAgent(BaseAgent):
    name = "memory_agent"
    description = "Retrieves relevant memories from chat, system, and relationship memory layers"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state.get("session_id", "default")
        user_input = state.get("user_input", "")

        ctx = await memory_manager.retrieve_full_context(session_id, user_input)
        enriched = await memory_manager.build_enriched_prompt(session_id, user_input)

        logger.info(
            "MemoryAgent: retrieved context (chat=%d chars, system=%d chars, topic=%d chars)",
            len(ctx["chat_history"]),
            len(ctx["system_context"]),
            len(ctx["topic_context"]),
        )

        return {
            "chat_history": ctx["chat_history"],
            "system_context": ctx["system_context"],
            "topic_context": ctx["topic_context"],
            "enriched_context": enriched,
        }


memory_agent = MemoryAgent()
