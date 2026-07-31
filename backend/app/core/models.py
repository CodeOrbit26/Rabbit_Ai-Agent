"""Pydantic models / schemas used across the application."""
from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────────

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class IntentType(str, Enum):
    QUESTION = "question"
    TASK = "task"
    CREATIVE = "creative"
    ANALYSIS = "analysis"
    CONVERSATION = "conversation"
    FOLLOW_UP = "follow_up"


class MemoryCategory(str, Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    DECISION = "decision"
    GOAL = "goal"
    SUMMARY = "summary"


class AgentNodeName(str, Enum):
    MEMORY_RETRIEVAL = "memory_retrieval"
    CONTEXT_BUILDER = "context_builder"
    INTENT_ANALYSIS = "intent_analysis"
    PLANNING = "planning"
    LLM_EXECUTION = "llm_execution"
    VERIFICATION = "verification"
    MEMORY_UPDATE = "memory_update"
    RESPONSE = "response"


# ── Chat Messages ────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    session_id: str = "default"
    role: MessageRole
    content: str
    timestamp: float = Field(default_factory=time.time)


# ── Memory Records ───────────────────────────────────────────────────────────

class MemoryRecord(BaseModel):
    """A single piece of extracted knowledge stored in system memory."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    session_id: str = "default"
    category: MemoryCategory
    content: str
    source_message_id: str = ""
    importance: float = 0.5          # 0-1 scale
    created_at: float = Field(default_factory=time.time)


class TopicRecord(BaseModel):
    """A tracked conversation topic stored in relationship memory."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    session_id: str = "default"
    topic: str
    summary: str = ""
    frequency: int = 1
    first_discussed: float = Field(default_factory=time.time)
    last_discussed: float = Field(default_factory=time.time)
    related_topics: list[str] = Field(default_factory=list)
    outcomes: list[str] = Field(default_factory=list)


# ── Agent State & Results ────────────────────────────────────────────────────

class IntentResult(BaseModel):
    intent_type: IntentType = IntentType.CONVERSATION
    confidence: float = 0.0
    entities: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    requires_tools: bool = False
    summary: str = ""


class ExecutionPlan(BaseModel):
    steps: list[str] = Field(default_factory=list)
    requires_verification: bool = False
    requires_reflection: bool = False
    estimated_complexity: str = "low"      # low | medium | high


class VerificationResult(BaseModel):
    is_valid: bool = True
    score: float = 1.0
    issues: list[str] = Field(default_factory=list)
    corrected_response: str = ""


# ── WebSocket Protocol ───────────────────────────────────────────────────────

class WSMessageType(str, Enum):
    CHAT = "chat"                  # user sends a message
    TOKEN = "token"                # streaming token from LLM
    AGENT_STATUS = "agent_status"  # which agent node is active
    DONE = "done"                  # generation complete
    ERROR = "error"
    MEMORY_UPDATE = "memory_update"
    HISTORY = "history"            # full chat history response


class WSIncoming(BaseModel):
    """Message sent from frontend → backend over WebSocket."""
    type: WSMessageType = WSMessageType.CHAT
    content: str = ""
    session_id: str = "default"
    # Optional: frontend can pass API keys and model choice per-request
    gemini_api_key: str = ""
    openai_api_key: str = ""
    model: str = "auto"
    ollama_url: str = ""
    ollama_model: str = ""


class WSOutgoing(BaseModel):
    """Message sent from backend → frontend over WebSocket."""
    type: WSMessageType
    content: str = ""
    node: str = ""                 # current agent node name
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── REST API ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    model: str = "auto"
    ollama_url: str = ""
    ollama_model: str = ""


class ChatResponse(BaseModel):
    response: str
    session_id: str
    memories_updated: int = 0
    topics_tracked: int = 0
