"""Reflection Agent — analyses conversation quality and suggests improvements."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base_agent import BaseAgent, get_llm_from_state, quick_llm_call

logger = logging.getLogger(__name__)

REFLECTION_PROMPT = """You are a reflection agent. Analyse this conversation turn and provide insights.

User message: {user_input}
AI response: {llm_response}
Intent: {intent_type}
Verification score: {verification_score}

Consider:
1. Was the response tone appropriate?
2. Could the response be more helpful?
3. Should the AI have asked clarifying questions?
4. Any patterns to note for future interactions?

Return a JSON object:
- "quality_assessment": string (one sentence)
- "improvement_suggestions": list of strings
- "should_ask_clarification": boolean
- "noted_patterns": list of strings

Return ONLY the JSON object. No markdown fences."""


class ReflectionAgent(BaseAgent):
    name = "reflection_agent"
    description = "Analyses conversation quality and identifies improvement opportunities"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        llm = get_llm_from_state(state, temperature=0.3)

        prompt = REFLECTION_PROMPT.format(
            user_input=state.get("user_input", ""),
            llm_response=state.get("llm_response", "")[:1500],
            intent_type=state.get("intent_type", "conversation"),
            verification_score=state.get("verification_score", 1.0),
        )

        try:
            raw = await quick_llm_call(prompt, llm)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            logger.info("ReflectionAgent: %s", result.get("quality_assessment", ""))
        except Exception as e:
            logger.warning("ReflectionAgent failed: %s", e)

        # Reflection doesn't modify state — it logs insights for future use
        return {}


reflection_agent = ReflectionAgent()
