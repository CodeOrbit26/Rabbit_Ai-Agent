"""Planning Agent — creates an execution plan based on intent and context."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base_agent import BaseAgent, get_llm_from_state, quick_llm_call, extract_json_str

logger = logging.getLogger(__name__)

PLANNING_PROMPT = """You are a planning agent. Based on the user's intent and context, create an execution plan.

User input: {user_input}
Intent type: {intent_type}
Intent summary: {intent_summary}
Available context length: {context_length} characters

Create a plan with:
- "steps": list of 1-5 execution steps as strings
- "requires_verification": boolean - should the response be fact-checked?
- "requires_reflection": boolean - should quality be reviewed?
- "estimated_complexity": "low" | "medium" | "high"

Simple conversations = low complexity, no verification.
Factual questions = medium, with verification.
Complex analysis/tasks = high, with verification and reflection.

Return ONLY a JSON object. No markdown fences."""


class PlanningAgent(BaseAgent):
    name = "planning_agent"
    description = "Creates an execution plan based on intent analysis"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        intent_type = state.get("intent_type", "conversation")
        user_input = state.get("user_input", "")

        # Fast path: instant routing for standard conversation (< 0.1ms)
        if intent_type == "conversation" or len(user_input.strip()) < 300:
            return {
                "execution_steps": ["Generate response"],
                "requires_verification": False,
                "requires_reflection": False,
                "estimated_complexity": "low",
            }

        llm = get_llm_from_state(state, temperature=0.1)

        prompt = PLANNING_PROMPT.format(
            user_input=state.get("user_input", ""),
            intent_type=state.get("intent_type", "conversation"),
            intent_summary=state.get("intent_summary", ""),
            context_length=len(state.get("enriched_context", "")),
        )

        try:
            raw = await quick_llm_call(prompt, llm)
            json_str = extract_json_str(raw)
            result = json.loads(json_str) if json_str else {}
        except Exception as e:
            logger.warning("PlanningAgent failed: %s — using defaults", e)
            result = {}

        return {
            "execution_steps": result.get("steps", ["Generate response"]),
            "requires_verification": result.get("requires_verification", False),
            "requires_reflection": result.get("requires_reflection", False),
            "estimated_complexity": result.get("estimated_complexity", "low"),
        }


planning_agent = PlanningAgent()
