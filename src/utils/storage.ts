import type { Chat, ApiKeys, AppSettings } from '../types';

const KEYS = {
  chats: 'aria_chats',
  apiKeys: 'aria_api_keys',
  settings: 'aria_settings',
} as const;

export function saveChats(chats: Chat[]): void {
  try {
    localStorage.setItem(KEYS.chats, JSON.stringify(chats));
  } catch (e) {
    console.error('Failed to save chats:', e);
  }
}

export function loadChats(): Chat[] {
  try {
    const data = localStorage.getItem(KEYS.chats);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(KEYS.apiKeys, JSON.stringify(keys));
  } catch (e) {
    console.error('Failed to save API keys:', e);
  }
}

export function loadApiKeys(): ApiKeys {
  try {
    const data = localStorage.getItem(KEYS.apiKeys);
    const parsed = data ? JSON.parse(data) : null;
    return {
      gemini: parsed?.gemini || '',
      openai: parsed?.openai || '',
    };
  } catch {
    return { gemini: '', openai: '' };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadSettings(): AppSettings {
  try {
    const data = localStorage.getItem(KEYS.settings);
    return data ? JSON.parse(data) : { 
      theme: 'dark', 
      selectedModel: 'auto', 
      userName: 'Abhay Gupta',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3'
    };
  } catch {
    return { 
      theme: 'dark', 
      selectedModel: 'auto', 
      userName: 'Abhay Gupta',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3'
    };
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
