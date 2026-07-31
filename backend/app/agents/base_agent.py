"""Base agent class — shared LLM initialisation and utilities."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)


def get_llm(
    provider: str = "gemini",
    gemini_api_key: str = "",
    openai_api_key: str = "",
    model_name: str = "",
    ollama_url: str = "http://localhost:11434",
    ollama_model: str = "llama3",
    temperature: float = 0.7,
    streaming: bool = False,
) -> BaseChatModel:
    """Return a LangChain chat model for the requested provider and specific model."""
    if provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            model=model_name or ollama_model or "llama3",
            base_url=ollama_url or "http://localhost:11434",
            temperature=temperature,
        )

    if provider == "openai":
        if not openai_api_key:
            raise ValueError("No OpenAI API key provided. Please add your key in Settings → AI Keys.")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model_name or "gpt-4o-mini",
            api_key=openai_api_key,
            temperature=temperature,
            streaming=streaming,
        )

    # Default: Gemini
    if not gemini_api_key:
        raise ValueError("No Gemini API key provided. Please add your key in Settings → AI Keys.")
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=model_name or "gemini-2.0-flash",
        google_api_key=gemini_api_key,
        temperature=temperature,
        streaming=streaming,
        max_retries=0,
    )


def get_llm_from_state(
    state: dict[str, Any],
    temperature: float = 0.7,
    streaming: bool = False,
) -> BaseChatModel:
    """Convenience helper to create an LLM model instance from AgentState keys."""
    return get_llm(
        provider=state.get("llm_provider", "gemini"),
        gemini_api_key=state.get("gemini_api_key", ""),
        openai_api_key=state.get("openai_api_key", ""),
        model_name=state.get("model_name", ""),
        ollama_url=state.get("ollama_url", "http://localhost:11434"),
        ollama_model=state.get("ollama_model", "llama3"),
        temperature=temperature,
        streaming=streaming,
    )


import re


def extract_json_str(text: str) -> str:
    """Extract JSON object or array string from an LLM response string."""
    if not text:
        return ""
    text = text.strip()
    # Match markdown codeblock: ```json ... ```
    match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Match raw JSON object or array
    match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


async def quick_llm_call(prompt: str, llm: BaseChatModel) -> str:
    """One-shot LLM call returning a plain string — used by memory extractors."""
    from langchain_core.messages import HumanMessage
    result = await llm.ainvoke([HumanMessage(content=prompt)])
    return result.content if hasattr(result, "content") else str(result)


class BaseAgent(ABC):
    """Abstract agent that every concrete agent inherits from."""

    name: str = "base"
    description: str = ""

    @abstractmethod
    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        """Run the agent logic and return updated state keys."""
        ...
