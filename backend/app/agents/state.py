"""LangGraph state definition — the TypedDict that flows through every node."""
from __future__ import annotations

from typing import Any, Annotated, TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """Mutable state passed through the LangGraph."""
    user_input: str
    session_id: str
    gemini_api_key: str
    openai_api_key: str
    model: str
    llm_provider: str
    model_name: str
    ollama_url: str
    ollama_model: str
    messages: list[Any]
    chat_history: str
    system_context: str
    topic_context: str
    enriched_context: str
    intent_type: str
    intent_confidence: float
    intent_entities: list[str]
    intent_topics: list[str]
    intent_summary: str
    execution_steps: list[str]
    requires_verification: bool
    requires_reflection: bool
    estimated_complexity: str
    llm_response: str
    streaming_tokens: list[str]
    verification_valid: bool
    verification_score: float
    verification_issues: list[str]
    memories_created: int
    topics_tracked: int
    final_response: str
    current_node: str
    error: str
    _streaming_callback: Any


def resolve_llm_config(
    model: str = "auto",
    gemini_api_key: str = "",
    openai_api_key: str = "",
    ollama_url: str = "",
    ollama_model: str = "",
) -> tuple[str, str, str, str]:
    """Resolve (provider, model_name, ollama_url, ollama_model) from requested model and keys."""
    m = (model or "auto").lower()

    if m == "ollama":
        return "ollama", ollama_model or "llama3", ollama_url or "http://localhost:11434", ollama_model or "llama3"

    if m == "gpt-4o":
        return "openai", "gpt-4o", "", ""
    if m == "gpt-4o-mini":
        return "openai", "gpt-4o-mini", "", ""

    if m == "gemini-3.6-flash":
        return "gemini", "gemini-3.6-flash", "", ""
    if m == "gemini-3.5-pro":
        return "gemini", "gemini-3.1-pro-preview", "", ""
    if m == "gemini-2.0-flash":
        return "gemini", "gemini-2.0-flash", "", ""
    if m == "gemini-pro":
        return "gemini", "gemini-1.5-pro", "", ""
    if m == "gemini-flash":
        return "gemini", "gemini-3.6-flash", "", ""

    # "auto" or unrecognized model
    if gemini_api_key:
        return "gemini", "gemini-3.6-flash", "", ""
    elif openai_api_key:
        return "openai", "gpt-4o-mini", "", ""
    elif ollama_url or m == "ollama":
        return "ollama", ollama_model or "llama3", ollama_url or "http://localhost:11434", ollama_model or "llama3"
    else:
        return "gemini", "gemini-3.6-flash", "", ""


# Default initial state factory
def make_initial_state(
    user_input: str,
    session_id: str = "default",
    gemini_api_key: str = "",
    openai_api_key: str = "",
    model: str = "auto",
    ollama_url: str = "",
    ollama_model: str = "",
) -> AgentState:
    provider, model_name, res_ollama_url, res_ollama_model = resolve_llm_config(
        model=model,
        gemini_api_key=gemini_api_key,
        openai_api_key=openai_api_key,
        ollama_url=ollama_url,
        ollama_model=ollama_model,
    )

    return AgentState(
        # ── input ────────────────────────────────────────────────────
        user_input=user_input,
        session_id=session_id,

        # ── API keys & Model configuration ───────────────────────────
        gemini_api_key=gemini_api_key,
        openai_api_key=openai_api_key,
        model=model,
        llm_provider=provider,
        model_name=model_name,
        ollama_url=res_ollama_url,
        ollama_model=res_ollama_model,

        # ── messages (LangChain BaseMessage list) ────────────────────
        messages=[],

        # ── memory context (populated by memory_retrieval node) ──────
        chat_history="",
        system_context="",
        topic_context="",
        enriched_context="",

        # ── intent (populated by intent_analysis node) ───────────────
        intent_type="conversation",
        intent_confidence=0.0,
        intent_entities=[],
        intent_topics=[],
        intent_summary="",

        # ── plan (populated by planning node) ────────────────────────
        execution_steps=[],
        requires_verification=False,
        requires_reflection=False,
        estimated_complexity="low",

        # ── LLM response (populated by llm_execution node) ──────────
        llm_response="",
        streaming_tokens=[],

        # ── verification (populated by verification node) ────────────
        verification_valid=True,
        verification_score=1.0,
        verification_issues=[],

        # ── memory update results ────────────────────────────────────
        memories_created=0,
        topics_tracked=0,

        # ── final output ─────────────────────────────────────────────
        final_response="",

        # ── workflow control ─────────────────────────────────────────
        current_node="",
        error="",
    )
