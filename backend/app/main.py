"""Aria Agentic AI Backend — FastAPI + WebSocket server.

Endpoints:
  WS  /ws/chat              — real-time streaming chat
  GET /                      — health check
  GET /api/memory/status     — memory stats
  GET /api/sessions          — list chat sessions
  GET /api/sessions/{id}     — get session history
  POST /api/chat             — HTTP chat fallback
"""
from __future__ import annotations

import json
import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.models import (
    WSIncoming, WSOutgoing, WSMessageType,
    ChatRequest, ChatResponse,
)
from app.db.database import db
from app.db.vector_store import vector_store
from app.memory.memory_manager import memory_manager
from app.memory.chat_memory import chat_memory
from app.agents.state import make_initial_state, AgentState
from app.agents.graph import agent_graph

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting Qova — QuantaForge Autonomous Intelligence backend …")
    await db.connect()
    await vector_store.initialize()
    logger.info("✅ Database and vector store ready")
    yield
    # Shutdown
    await db.close()
    logger.info("👋 Qova backend shut down")


app = FastAPI(
    title="Qova — QuantaForge Autonomous Intelligence Backend",
    version="2.0.0",
    description="LangGraph-powered agentic backend with 3-layer memory",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "online",
        "system": "Qova — QuantaForge Autonomous Intelligence",
        "version": "2.0.0",
        "graph_nodes": [
            "memory_retrieval", "context_builder", "intent_analysis",
            "planning", "llm_execution", "verification",
            "memory_update", "response",
        ],
        "memory_layers": ["chat", "system", "relationship"],
    }


# ── Memory Status ─────────────────────────────────────────────────────────────

@app.get("/api/memory/status")
async def get_memory_status():
    stats = await memory_manager.get_stats()
    return stats


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def list_sessions():
    sessions = await db.get_all_sessions()
    return {"sessions": sessions}


@app.get("/api/sessions/{session_id}")
async def get_session_history(session_id: str):
    history = await chat_memory.get_history(session_id)
    return {
        "session_id": session_id,
        "messages": [
            {"id": m.id, "role": m.role.value, "content": m.content, "timestamp": m.timestamp}
            for m in history
        ],
    }


# ── HTTP Chat (fallback) ─────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def http_chat(req: ChatRequest):
    """Non-streaming chat endpoint — runs the full LangGraph and returns."""
    initial = make_initial_state(
        user_input=req.message,
        session_id=req.session_id,
        gemini_api_key=req.gemini_api_key or settings.gemini_api_key,
        openai_api_key=req.openai_api_key or settings.openai_api_key,
        model=req.model or "auto",
        ollama_url=req.ollama_url or getattr(settings, "ollama_url", "http://localhost:11434"),
        ollama_model=req.ollama_model or getattr(settings, "ollama_model", "llama3"),
    )

    final_state = await agent_graph.ainvoke(initial)

    return ChatResponse(
        response=final_state.get("final_response", ""),
        session_id=req.session_id,
        memories_updated=final_state.get("memories_created", 0),
        topics_tracked=final_state.get("topics_tracked", 0),
    )


# ── WebSocket Chat (primary) ─────────────────────────────────────────────────

@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await ws.accept()
    logger.info("WebSocket connected")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                incoming = WSIncoming.model_validate_json(raw)
            except Exception:
                await _ws_send(ws, WSMessageType.ERROR, content="Invalid message format")
                continue

            if incoming.type == WSMessageType.HISTORY:
                # Return chat history for the session
                history = await chat_memory.get_history(incoming.session_id)
                await _ws_send(ws, WSMessageType.HISTORY, content=json.dumps([
                    {"id": m.id, "role": m.role.value, "content": m.content, "timestamp": m.timestamp}
                    for m in history
                ]))
                continue

            if incoming.type != WSMessageType.CHAT:
                continue

            # ── Run the LangGraph ─────────────────────────────────────
            await _run_graph_streaming(ws, incoming)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        try:
            await _ws_send(ws, WSMessageType.ERROR, content=str(e))
        except Exception:
            pass


async def _run_graph_streaming(ws: WebSocket, incoming: WSIncoming) -> None:
    """Execute the LangGraph with streaming tokens sent over WebSocket."""

    session_id = incoming.session_id or "default"
    gemini_key = incoming.gemini_api_key or settings.gemini_api_key
    openai_key = incoming.openai_api_key or settings.openai_api_key
    model = incoming.model or "auto"
    ollama_url = incoming.ollama_url or getattr(settings, "ollama_url", "http://localhost:11434")
    ollama_model = incoming.ollama_model or getattr(settings, "ollama_model", "llama3")

    # Build initial state
    initial = make_initial_state(
        user_input=incoming.content,
        session_id=session_id,
        gemini_api_key=gemini_key,
        openai_api_key=openai_key,
        model=model,
        ollama_url=ollama_url,
        ollama_model=ollama_model,
    )

    provider = initial.get("llm_provider", "gemini")
    if provider == "gemini" and not gemini_key:
        await _ws_send(ws, WSMessageType.ERROR, content="No Gemini API key provided. Set a key in Settings → AI Keys.")
        return
    elif provider == "openai" and not openai_key:
        await _ws_send(ws, WSMessageType.ERROR, content="No OpenAI API key provided. Set a key in Settings → AI Keys.")
        return
    # Create a streaming callback that sends tokens over WebSocket
    async def stream_token(token: str):
        await _ws_send(ws, WSMessageType.TOKEN, content=token)

    # Attach the streaming callback (private key, not serialised)
    initial["_streaming_callback"] = stream_token

    # Stream node status updates + run graph
    try:
        # Send status: starting
        await _ws_send(ws, WSMessageType.AGENT_STATUS, node="llm_execution")

        final_state = await agent_graph.ainvoke(initial)

        # Send completion
        await _ws_send(
            ws,
            WSMessageType.DONE,
            content=final_state.get("final_response", ""),
            metadata={
                "memories_created": final_state.get("memories_created", 0),
                "topics_tracked": final_state.get("topics_tracked", 0),
                "verification_score": final_state.get("verification_score", 1.0),
            },
        )

    except Exception as e:
        logger.error("Graph execution error: %s", e, exc_info=True)
        await _ws_send(ws, WSMessageType.ERROR, content=f"Error: {str(e)}")


async def _ws_send(
    ws: WebSocket,
    msg_type: WSMessageType,
    content: str = "",
    node: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    """Send a structured message over WebSocket."""
    msg = WSOutgoing(type=msg_type, content=content, node=node, metadata=metadata or {})
    await ws.send_text(msg.model_dump_json())
