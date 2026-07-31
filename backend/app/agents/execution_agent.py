"""Execution Agent — runs the main LLM call with true token-by-token streaming."""
from __future__ import annotations

import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from app.agents.base_agent import BaseAgent, get_llm_from_state
from app.memory.chat_memory import chat_memory

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Aria, a helpful AI assistant. Be concise and accurate.
Use markdown formatting when useful. Keep responses focused and relevant."""


async def _stream_gemini_direct(
    messages: list,
    api_key: str,
    model_name: str,
    streaming_callback,
) -> str:
    """Use google-genai SDK directly for true token-by-token streaming."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    # Convert LangChain messages to GenAI format
    contents = []
    system_instruction = None

    for msg in messages:
        if isinstance(msg, SystemMessage):
            system_instruction = msg.content
        elif isinstance(msg, HumanMessage):
            contents.append(types.Content(role="user", parts=[types.Part(text=msg.content)]))
        elif isinstance(msg, AIMessage):
            contents.append(types.Content(role="model", parts=[types.Part(text=msg.content)]))

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
    )

    full_response = ""
    async for chunk in client.aio.models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            full_response += chunk.text
            await streaming_callback(chunk.text)

    return full_response


class ExecutionAgent(BaseAgent):
    name = "execution_agent"
    description = "Executes the main LLM call and streams the response"

    async def execute(self, state: dict[str, Any]) -> dict[str, Any]:
        session_id = state.get("session_id", "default")
        user_input = state.get("user_input", "")
        enriched_context = state.get("enriched_context", "")
        streaming_callback = state.get("_streaming_callback")

        # Build system prompt
        system_text = SYSTEM_PROMPT
        if enriched_context:
            trimmed_ctx = enriched_context[:500]
            system_text += f"\n\nContext:\n{trimmed_ctx}"

        messages = [SystemMessage(content=system_text)]

        # Only load last 6 messages (3 turns)
        history = await chat_memory.get_langchain_messages(session_id, limit=6)
        for msg in history:
            if isinstance(msg, (HumanMessage, AIMessage)):
                messages.append(msg)

        messages.append(HumanMessage(content=user_input))

        try:
            full_response = ""
            provider = state.get("llm_provider", "gemini")
            model_name = state.get("model_name", "gemini-3.6-flash")
            gemini_key = state.get("gemini_api_key", "")

            if provider == "gemini" and gemini_key and streaming_callback:
                # Use direct Google GenAI SDK for true token-by-token streaming
                full_response = await _stream_gemini_direct(
                    messages, gemini_key, model_name, streaming_callback
                )
            else:
                # Fallback to LangChain for OpenAI/Ollama
                llm = get_llm_from_state(state, temperature=0.7, streaming=True)
                if streaming_callback:
                    async for chunk in llm.astream(messages):
                        token = chunk.content if hasattr(chunk, "content") else str(chunk)
                        if token:
                            full_response += token
                            await streaming_callback(token)
                else:
                    result = await llm.ainvoke(messages)
                    full_response = result.content if hasattr(result, "content") else str(result)

        except Exception as e:
            err_str = str(e)
            logger.error("ExecutionAgent LLM call failed: %s", err_str)

            model_name = state.get("model_name", "unknown")
            if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
                error_msg = (
                    f"⚠️ **API quota exceeded for `{model_name}`.**\n\n"
                    "Your free-tier daily limit has been reached. You can:\n"
                    "- **Switch to a different model** from the dropdown above\n"
                    "- **Wait for quota reset** (resets daily)\n"
                    "- **Upgrade your API key** to a paid plan"
                )
            else:
                error_msg = (
                    f"⚠️ **Model `{model_name}` failed.**\n\n"
                    f"Error: {err_str}\n\n"
                    "Please try switching to a different model from the dropdown above."
                )

            if streaming_callback:
                await streaming_callback(error_msg)
            full_response = error_msg

        return {
            "llm_response": full_response,
        }


execution_agent = ExecutionAgent()
