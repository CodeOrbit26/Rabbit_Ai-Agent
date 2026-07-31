import type { Message, ModelId, ApiKeys } from '../types';

const WS_URL = 'ws://localhost:8000/ws/chat';
const HTTP_URL = 'http://localhost:8000';

/**
 * Fetch installed local models from Ollama server.
 */
export async function fetchOllamaModels(baseUrl: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name || m.model);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Stream chat via WebSocket to the Python backend.
 * Falls back to direct LLM calls if backend is unreachable.
 */
export async function* streamChat(
  messages: Message[],
  model: ModelId,
  apiKeys: ApiKeys,
  ollamaSettings?: { url: string; model: string },
  sessionId: string = 'default',
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  // Try WebSocket backend first
  try {
    yield* streamViaWebSocket(messages, model, apiKeys, ollamaSettings, sessionId, signal);
    return;
  } catch (e) {
    console.warn('WebSocket backend unavailable, falling back to direct LLM:', e);
  }

  // Fallback: direct LLM calls (original behaviour)
  yield* streamDirectLLM(messages, model, apiKeys, ollamaSettings, signal);
}

/**
 * Stream via WebSocket to the Python LangGraph backend.
 */
async function* streamViaWebSocket(
  messages: Message[],
  model: ModelId,
  apiKeys: ApiKeys,
  ollamaSettings?: { url: string; model: string },
  sessionId: string = 'default',
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const lastUserMsg = messages[messages.length - 1];
  if (!lastUserMsg || lastUserMsg.role !== 'user') {
    return;
  }

  if (signal?.aborted) return;

  const ws = new WebSocket(WS_URL);

  const onAbort = () => {
    try {
      ws.close();
    } catch {}
  };

  if (signal) {
    signal.addEventListener('abort', onAbort);
  }

  // Wrap WebSocket in a promise-based message queue
  const messageQueue: string[] = [];
  let resolveNext: ((value: string | null) => void) | null = null;
  let done = false;
  let error: string | null = null;

  ws.onopen = () => {
    // Send the chat message
    ws.send(JSON.stringify({
      type: 'chat',
      content: lastUserMsg.content,
      session_id: sessionId,
      gemini_api_key: apiKeys.gemini || '',
      openai_api_key: apiKeys.openai || '',
      model: model,
      ollama_url: ollamaSettings?.url || '',
      ollama_model: ollamaSettings?.model || '',
    }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'token') {
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r(msg.content);
        } else {
          messageQueue.push(msg.content);
        }
      } else if (msg.type === 'done') {
        done = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r(null);
        }
      } else if (msg.type === 'error') {
        error = msg.content || 'Unknown backend error';
        done = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = null;
          r(null);
        }
      }
      // agent_status and memory_update events are informational
    } catch {
      // Ignore parse errors
    }
  };

  ws.onerror = () => {
    error = 'WebSocket connection error';
    done = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(null);
    }
  };

  ws.onclose = () => {
    done = true;
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(null);
    }
  };

  try {
    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        try { ws.close(); } catch {}
        reject(new Error('Aborted'));
        return;
      }
      const origOnOpen = ws.onopen;
      ws.onopen = (e) => {
        if (origOnOpen) (origOnOpen as any).call(ws, e);
        resolve();
      };
      const origOnError = ws.onerror;
      ws.onerror = (e) => {
        if (origOnError) (origOnError as any).call(ws, e);
        reject(new Error('WebSocket connection failed'));
      };
    });

    // Yield tokens as they arrive
    while (!done || messageQueue.length > 0) {
      if (signal?.aborted) break;
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else if (!done) {
        const token = await new Promise<string | null>((resolve) => {
          resolveNext = resolve;
        });
        if (token === null || signal?.aborted) break;
        yield token;
      }
    }

    if (error && !signal?.aborted) {
      throw new Error(error);
    }
  } finally {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    } catch {}
  }
}

/**
 * Direct LLM calls — fallback when backend is not running.
 */
async function* streamDirectLLM(
  messages: Message[],
  model: ModelId,
  apiKeys: ApiKeys,
  ollamaSettings?: { url: string; model: string },
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const provider = resolveProvider(model, apiKeys);

  if (provider === 'ollama') {
    yield* streamOllama(messages, ollamaSettings?.model || 'llama3', ollamaSettings?.url || 'http://localhost:11434');
  } else if (provider === 'gemini') {
    if (!apiKeys.gemini) {
      yield 'Please add your Gemini API key in Settings → AI Keys to start chatting.';
      return;
    }
    yield* streamGemini(messages, getGeminiModelName(model), apiKeys.gemini);
  } else {
    if (!apiKeys.openai) {
      yield 'Please add your OpenAI API key in Settings → AI Keys to start chatting.';
      return;
    }
    yield* streamOpenAI(messages, getOpenAIModelName(model), apiKeys.openai);
  }
}

// ── Helper functions ────────────────────────────────────────────────────────

function getGeminiModelName(model: ModelId): string {
  switch (model) {
    case 'gemini-3.6-flash': return 'gemini-3.6-flash';
    case 'gemini-3.5-pro': return 'gemini-3.1-pro-preview';
    case 'gemini-2.0-flash': return 'gemini-2.0-flash';
    case 'gemini-pro': return 'gemini-1.5-pro';
    case 'gemini-flash':
    case 'auto':
    default:
      return 'gemini-3.6-flash';
  }
}

function getOpenAIModelName(model: ModelId): string {
  switch (model) {
    case 'gpt-4o': return 'gpt-4o';
    case 'gpt-4o-mini': return 'gpt-4o-mini';
    default: return 'gpt-4o-mini';
  }
}

function resolveProvider(model: ModelId, apiKeys: ApiKeys): 'gemini' | 'openai' | 'ollama' {
  if (model === 'ollama') return 'ollama';
  if (model === 'auto') {
    if (apiKeys.gemini) return 'gemini';
    if (apiKeys.openai) return 'openai';
    return 'gemini';
  }
  if (model === 'gpt-4o' || model === 'gpt-4o-mini') return 'openai';
  return 'gemini';
}

// ── Direct LLM streaming implementations (kept as fallback) ─────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';

async function* streamGemini(
  messages: Message[], modelName: string, apiKey: string,
): AsyncGenerator<string, void, unknown> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    }));
    const lastMessage = messages[messages.length - 1];
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (error: any) {
    yield `\n\n⚠️ Gemini Error: ${error.message || error}`;
  }
}

async function* streamOpenAI(
  messages: Message[], modelName: string, apiKey: string,
): AsyncGenerator<string, void, unknown> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        stream: true,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      yield `⚠️ OpenAI Error: ${(err as any)?.error?.message || response.statusText}`;
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip */ }
      }
    }
  } catch (error: any) {
    yield `\n\n⚠️ OpenAI Error: ${error.message || error}`;
  }
}

async function* streamOllama(
  messages: Message[], modelName: string, ollamaUrl: string,
): AsyncGenerator<string, void, unknown> {
  try {
    const cleanUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
    const response = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        stream: true,
      }),
    });
    if (!response.ok) {
      yield `⚠️ Ollama Error: ${await response.text()}`;
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || cleaned === 'data: [DONE]') continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const data = JSON.parse(cleaned.slice(6));
            const text = data.choices?.[0]?.delta?.content;
            if (text) yield text;
          } catch { /* skip */ }
        }
      }
    }
  } catch (error: any) {
    yield `⚠️ Ollama Error: ${error.message || error}`;
  }
}
