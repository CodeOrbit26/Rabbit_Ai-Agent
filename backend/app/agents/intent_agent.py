"""Intent Agent — classifies user intent and extracts entities/topics."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.base_agent import BaseAgent, get_llm_from_state, quick_llm_call, extract_json_str

logger = logging.getLogger(__name__)

INTENT_PROMPT = """You are an intent classifier. Analyse the user's message and determine:

1. intent_type: one of "question", "task", "creative", "analysis", "conversation", "follow_up"
2. confidence: float 0-1
3. entities: list of key entities mentioned
4. topics: list of main topics
5. requires_tools: boolean - does this need external tools?
6. summary: one-sentence summary of what the user wants

User message: {user_input}

Conversation context (if any):
{context}

Return ONLY a JSON object with the above fields. No markdown fences."""


class IntentAgent(BaseAgent):
    name = "intent_agent"
    description = "Classifies user intent and extracts entities and topics"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        user_input = state.get("user_input", "")
        context = state.get("chat_history", "")
        trimmed = user_input.strip().lower()

        # Fast path: instant classification for standard queries (< 0.1ms)
        if len(trimmed) < 300 and not any(kw in trimmed for kw in ["search web", "run python", "write code for", "execute script"]):
            return {
                "intent_type": "conversation",
                "intent_confidence": 0.95,
                "intent_entities": [],
                "intent_topics": [],
                "intent_summary": user_input[:100],
            }

        llm = get_llm_from_state(state, temperature=0.1)

        prompt = INTENT_PROMPT.format(user_input=user_input, context=context[:1000])

        try:
            raw = await quick_llm_call(prompt, llm)
            json_str = extract_json_str(raw)
            result = json.loads(json_str) if json_str else {}
        except Exception as e:
            logger.warning("IntentAgent failed: %s", e)
            result = {}

        return {
            "intent_type": result.get("intent_type", "conversation"),
            "intent_confidence": float(result.get("confidence", 0.5)),
            "intent_entities": result.get("entities", []),
            "intent_topics": result.get("topics", []),
            "intent_summary": result.get("summary", ""),
        }


intent_agent = IntentAgent()
