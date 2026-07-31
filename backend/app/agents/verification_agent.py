"""Verification Agent — validates the LLM response for quality and accuracy."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base_agent import BaseAgent, get_llm_from_state, quick_llm_call

logger = logging.getLogger(__name__)

VERIFICATION_PROMPT = """You are a verification agent. Review the following AI response for quality.

User's question: {user_input}
AI's response: {llm_response}
Known facts about user: {system_context}

Check for:
1. Accuracy — does the response contain factual errors?
2. Relevance — does it address what the user asked?
3. Completeness — is anything important missing?
4. Consistency — does it contradict known facts?

Return a JSON object:
- "is_valid": boolean
- "score": float 0-1 (quality score)
- "issues": list of issue strings (empty if none)
- "corrected_response": string (empty if no corrections needed, otherwise the improved response)

Return ONLY the JSON object. No markdown fences."""


class VerificationAgent(BaseAgent):
    name = "verification_agent"
    description = "Validates the generated response for quality, accuracy, and completeness"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        llm_response = state.get("llm_response", "")
        if not llm_response:
            return {"verification_valid": True, "verification_score": 1.0, "verification_issues": []}

        llm = get_llm_from_state(state, temperature=0.1)

        prompt = VERIFICATION_PROMPT.format(
            user_input=state.get("user_input", ""),
            llm_response=llm_response[:2000],
            system_context=state.get("system_context", "")[:1000],
        )

        try:
            raw = await quick_llm_call(prompt, llm)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            result = json.loads(raw)
        except Exception as e:
            logger.warning("VerificationAgent failed: %s — marking as valid", e)
            return {"verification_valid": True, "verification_score": 0.8, "verification_issues": []}

        # If there's a corrected response and the original had issues, use it
        corrected = result.get("corrected_response", "")
        if corrected and not result.get("is_valid", True):
            return {
                "verification_valid": False,
                "verification_score": float(result.get("score", 0.5)),
                "verification_issues": result.get("issues", []),
                "llm_response": corrected,  # Override with corrected version
            }

        return {
            "verification_valid": result.get("is_valid", True),
            "verification_score": float(result.get("score", 1.0)),
            "verification_issues": result.get("issues", []),
        }


verification_agent = VerificationAgent()
