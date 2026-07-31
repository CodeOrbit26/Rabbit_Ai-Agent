"""LangGraph StateGraph — ultra-lean, fast pipeline.

Only 1 LLM API call per user message. Zero memory lookups to minimize latency.
  1. llm_execution → single streaming LLM call (the ONLY API call)
  2. finalise      → save messages to DB + return response (no LLM)
"""
from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import StateGraph, END

from app.agents.state import AgentState
from app.agents.execution_agent import execution_agent
from app.memory.chat_memory import chat_memory

logger = logging.getLogger(__name__)


# ── Node functions ────────────────────────────────────────────────────────────

async def llm_execution_node(state: AgentState) -> dict[str, Any]:
    """Node 1: Single streaming LLM call — the ONLY API call."""
    logger.info("▶ Node: llm_execution")
    result = await execution_agent.execute(state)
    result["current_node"] = "llm_execution"
    return result


async def finalise_node(state: AgentState) -> dict[str, Any]:
    """Node 2: Save messages to DB and format response (no LLM call)."""
    logger.info("▶ Node: finalise")
    session_id = state.get("session_id", "default")
    user_input = state.get("user_input", "")
    llm_response = state.get("llm_response", "")

    # Save chat messages to DB (no LLM call needed)
    await chat_memory.add_user_message(session_id, user_input)
    await chat_memory.add_assistant_message(session_id, llm_response)

    return {
        "final_response": llm_response,
        "memories_created": 0,
        "topics_tracked": 0,
        "current_node": "finalise",
    }


# ── Build the graph ───────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """Construct and compile the ultra-lean LangGraph StateGraph."""
    graph = StateGraph(AgentState)

    # Only 2 nodes — minimal overhead
    graph.add_node("llm_execution", llm_execution_node)
    graph.add_node("finalise", finalise_node)

    # Linear: llm_execution → finalise → END
    graph.set_entry_point("llm_execution")
    graph.add_edge("llm_execution", "finalise")
    graph.add_edge("finalise", END)

    return graph


# Compile once at module level
agent_graph = build_graph().compile()
