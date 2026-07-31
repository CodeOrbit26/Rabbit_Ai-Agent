"""Orchestrator Agent — top-level coordinator for workflow routing decisions."""
from __future__ import annotations

import logging
from typing import Any

from app.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class OrchestratorAgent(BaseAgent):
    name = "orchestrator_agent"
    description = "Determines workflow routing — decides which optional nodes to execute"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        """The orchestrator doesn't have its own LLM call — it makes routing
        decisions based on the planning agent's output and current state."""

        complexity = state.get("estimated_complexity", "low")
        intent = state.get("intent_type", "conversation")

        should_verify = state.get("requires_verification", False)
        should_reflect = state.get("requires_reflection", False)

        # Override: always verify for complex tasks or factual questions
        if complexity == "high" or intent in ("analysis", "task"):
            should_verify = True

        # Override: reflect on high-complexity tasks
        if complexity == "high":
            should_reflect = True

        logger.info(
            "Orchestrator: complexity=%s, intent=%s → verify=%s, reflect=%s",
            complexity, intent, should_verify, should_reflect,
        )

        return {
            "requires_verification": should_verify,
            "requires_reflection": should_reflect,
        }


orchestrator_agent = OrchestratorAgent()
