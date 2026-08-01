import { useState, useCallback, useRef, useEffect } from 'react';
import type { Chat, Message, ApiKeys, Theme, ModelId } from './types';
import { loadChats, saveChats, loadApiKeys, saveApiKeys, loadSettings, saveSettings, generateId } from './utils/storage';
import { streamChat } from './utils/ai';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import SearchModal from './components/SearchModal';
import { VoiceModal } from './components/VoiceModal';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

class SmoothStreamer {
  private queue: string = '';
  private displayed: string = '';
  private onUpdate: (text: string) => void;
  private animId: number | null = null;
  private isEnded: boolean = false;
  private resolveDone: (() => void) | null = null;

  constructor(onUpdate: (text: string) => void) {
    this.onUpdate = onUpdate;
  }

  public push(chunk: string) {
    this.queue += chunk;
    if (!this.animId) {
      this.tick();
    }
  }

  private tick = () => {
    if (this.queue.length > 0) {
      const step = Math.max(1, Math.min(8, Math.ceil(this.queue.length / 8)));
      const chars = this.queue.slice(0, step);
      this.queue = this.queue.slice(step);
      this.displayed += chars;
      this.onUpdate(this.displayed);
      this.animId = requestAnimationFrame(this.tick);
    } else {
      this.animId = null;
      if (this.isEnded && this.resolveDone) {
        this.resolveDone();
      }
    }
  };

  public async finish(): Promise<string> {
    this.isEnded = true;
    if (this.queue.length > 0) {
      await new Promise<void>((resolve) => {
        this.resolveDone = resolve;
      });
    }
    return this.displayed;
  }

  public stop(): string {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    return this.displayed;
  }
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => loadApiKeys());
  const [theme, setTheme] = useState<Theme>(() => loadSettings().theme);
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => loadSettings().selectedModel);
  const [ollamaUrl, setOllamaUrl] = useState(() => loadSettings().ollamaUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(() => loadSettings().ollamaModel || 'llama3');
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Apply theme on mount and change
  useEffect(() => {
    applyTheme(theme);

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [theme]);

  // Persist chats
  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  // Persist API keys
  useEffect(() => {
    saveApiKeys(apiKeys);
  }, [apiKeys]);

  // Persist settings
  useEffect(() => {
    saveSettings({ 
      theme, 
      selectedModel, 
      userName: 'Abhay Gupta', 
      ollamaUrl, 
      ollamaModel 
    });
  }, [theme, selectedModel, ollamaUrl, ollamaModel]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setStreamingContent('');
    setIsStreaming(false);
    setChatError(null);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setStreamingContent('');
    setIsStreaming(false);
    setChatError(null);
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  }, [activeChatId]);

  const handleRenameChat = useCallback((id: string, title: string) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  const handlePinChat = useCallback((id: string) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
  }, []);

  const handleChangeTheme = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  const handleChangeApiKeys = useCallback((newKeys: ApiKeys) => {
    setApiKeys(newKeys);
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleSend = useCallback(async (content: string) => {
    if (isStreaming) return;

    setChatError(null);

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    let chatId = activeChatId;
    let currentChat: Chat;

    if (!chatId) {
      // Create new chat
      const newChat: Chat = {
        id: generateId(),
        title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pinned: false,
      };
      chatId = newChat.id;
      currentChat = newChat;
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(chatId);
    } else {
      currentChat = chats.find(c => c.id === chatId)!;
      currentChat = {
        ...currentChat,
        messages: [...currentChat.messages, userMessage],
        updatedAt: Date.now(),
      };
      setChats(prev => prev.map(c => c.id === chatId ? currentChat : c));
    }

    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');
    abortRef.current = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = '';
    const streamer = new SmoothStreamer((text) => setStreamingContent(text));
    try {
      const stream = streamChat(
        currentChat.messages,
        selectedModel,
        apiKeys,
        { url: ollamaUrl, model: ollamaModel },
        chatId || 'default',
        controller.signal
      );

      for await (const chunk of stream) {
        if (abortRef.current || controller.signal.aborted) {
          streamer.stop();
          break;
        }
        streamer.push(chunk);
      }
      fullContent = await streamer.finish();
    } catch (error: any) {
      if (controller.signal.aborted) return;
      const errMsg = error.message || String(error);
      let formattedError = '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key')) {
        formattedError = '⚠️ Invalid API key. Please check your key in Settings → AI Keys.';
      } else if (
        errMsg.includes('RATE_LIMIT') || 
        errMsg.includes('429') || 
        errMsg.includes('exhausted') || 
        errMsg.includes('quota') || 
        errMsg.includes('Quota')
      ) {
        formattedError = `⚠️ Rate limit reached. Please wait a moment and try again.\n\n*(Detail from provider: ${errMsg})*`;
      } else {
        formattedError = `⚠️ Error: ${errMsg}`;
      }
      setChatError(formattedError);
    }

    // Add assistant message (only if we received actual response content)
    if (fullContent.trim()) {
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        variants: [{ content: fullContent, timestamp: Date.now() }],
        variantIndex: 0,
      };

      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: [...c.messages, assistantMessage],
            updatedAt: Date.now(),
          };
        }
        return c;
      }));
    }

    setIsStreaming(false);
    setStreamingContent('');
  }, [isStreaming, activeChatId, chats, selectedModel, apiKeys, ollamaUrl, ollamaModel]);

  const handleRegenerate = useCallback(async (userMessageId?: string) => {
    if (isStreaming || !activeChatId) return;

    const currentChat = chats.find(c => c.id === activeChatId);
    if (!currentChat || currentChat.messages.length === 0) return;

    let targetIndex = -1;
    if (userMessageId) {
      targetIndex = currentChat.messages.findIndex(m => m.id === userMessageId);
    } else {
      for (let i = currentChat.messages.length - 1; i >= 0; i--) {
        if (currentChat.messages[i].role === 'user') {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1) return;

    const messagesToKeep = currentChat.messages.slice(0, targetIndex + 1);
    const existingAssistantMsg = (targetIndex + 1 < currentChat.messages.length && currentChat.messages[targetIndex + 1].role === 'assistant')
      ? currentChat.messages[targetIndex + 1]
      : null;

    setChatError(null);
    setIsStreaming(true);
    setStreamingContent('');
    abortRef.current = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = '';
    const streamer = new SmoothStreamer((text) => setStreamingContent(text));
    try {
      const stream = streamChat(
        messagesToKeep,
        selectedModel,
        apiKeys,
        { url: ollamaUrl, model: ollamaModel },
        activeChatId,
        controller.signal
      );

      for await (const chunk of stream) {
        if (abortRef.current || controller.signal.aborted) {
          streamer.stop();
          break;
        }
        streamer.push(chunk);
      }
      fullContent = await streamer.finish();
    } catch (error: any) {
      if (controller.signal.aborted) return;
      const errMsg = error.message || String(error);
      let formattedError = '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key')) {
        formattedError = '⚠️ Invalid API key. Please check your key in Settings → AI Keys.';
      } else if (
        errMsg.includes('RATE_LIMIT') || 
        errMsg.includes('429') || 
        errMsg.includes('exhausted') || 
        errMsg.includes('quota') || 
        errMsg.includes('Quota')
      ) {
        formattedError = `⚠️ Rate limit reached. Please wait a moment and try again.\n\n*(Detail from provider: ${errMsg})*`;
      } else {
        formattedError = `⚠️ Error: ${errMsg}`;
      }
      setChatError(formattedError);
    }

    if (fullContent.trim()) {
      setChats(prev => prev.map(c => {
        if (c.id !== activeChatId) return c;

        let newMessages = [...messagesToKeep];
        if (existingAssistantMsg) {
          const oldVariants = existingAssistantMsg.variants || [{ content: existingAssistantMsg.content, timestamp: existingAssistantMsg.timestamp }];
          const updatedVariants = [...oldVariants, { content: fullContent, timestamp: Date.now() }];
          const updatedIndex = updatedVariants.length - 1;

          const updatedAssMsg: Message = {
            ...existingAssistantMsg,
            content: fullContent,
            timestamp: Date.now(),
            variants: updatedVariants,
            variantIndex: updatedIndex,
          };
          newMessages.push(updatedAssMsg);
        } else {
          const newAssMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
            variants: [{ content: fullContent, timestamp: Date.now() }],
            variantIndex: 0,
          };
          newMessages.push(newAssMsg);
        }

        return {
          ...c,
          messages: newMessages,
          updatedAt: Date.now(),
        };
      }));
    }

    setIsStreaming(false);
    setStreamingContent('');
  }, [isStreaming, activeChatId, chats, selectedModel, apiKeys, ollamaUrl, ollamaModel]);

  const handleEditUserMessage = useCallback(async (userMessageId: string, newContent: string) => {
    if (isStreaming || !activeChatId) return;

    const currentChat = chats.find(c => c.id === activeChatId);
    if (!currentChat) return;

    const targetIndex = currentChat.messages.findIndex(m => m.id === userMessageId);
    if (targetIndex === -1) return;

    const existingUserMsg = currentChat.messages[targetIndex];
    const oldUserVariants = existingUserMsg.variants || [{ content: existingUserMsg.content, timestamp: existingUserMsg.timestamp }];
    const newUserVariants = [...oldUserVariants, { content: newContent, timestamp: Date.now() }];
    const newUserIndex = newUserVariants.length - 1;

    const updatedUserMsg: Message = {
      ...existingUserMsg,
      content: newContent,
      timestamp: Date.now(),
      variants: newUserVariants,
      variantIndex: newUserIndex,
    };

    const messagesToKeep = [
      ...currentChat.messages.slice(0, targetIndex),
      updatedUserMsg
    ];

    const existingAssistantMsg = (targetIndex + 1 < currentChat.messages.length && currentChat.messages[targetIndex + 1].role === 'assistant')
      ? currentChat.messages[targetIndex + 1]
      : null;

    setChats(prev => prev.map(c => {
      if (c.id === activeChatId) {
        return {
          ...c,
          messages: messagesToKeep,
          updatedAt: Date.now(),
        };
      }
      return c;
    }));

    setChatError(null);
    setIsStreaming(true);
    setStreamingContent('');
    abortRef.current = false;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = '';
    const streamer = new SmoothStreamer((text) => setStreamingContent(text));
    try {
      const stream = streamChat(
        messagesToKeep,
        selectedModel,
        apiKeys,
        { url: ollamaUrl, model: ollamaModel },
        activeChatId,
        controller.signal
      );

      for await (const chunk of stream) {
        if (abortRef.current || controller.signal.aborted) {
          streamer.stop();
          break;
        }
        streamer.push(chunk);
      }
      fullContent = await streamer.finish();
    } catch (error: any) {
      if (controller.signal.aborted) return;
      const errMsg = error.message || String(error);
      let formattedError = '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key')) {
        formattedError = '⚠️ Invalid API key. Please check your key in Settings → AI Keys.';
      } else if (
        errMsg.includes('RATE_LIMIT') || 
        errMsg.includes('429') || 
        errMsg.includes('exhausted') || 
        errMsg.includes('quota') || 
        errMsg.includes('Quota')
      ) {
        formattedError = `⚠️ Rate limit reached. Please wait a moment and try again.\n\n*(Detail from provider: ${errMsg})*`;
      } else {
        formattedError = `⚠️ Error: ${errMsg}`;
      }
      setChatError(formattedError);
    }

    if (fullContent.trim()) {
      setChats(prev => prev.map(c => {
        if (c.id !== activeChatId) return c;

        let newMessages = [...messagesToKeep];
        if (existingAssistantMsg) {
          const oldVariants = existingAssistantMsg.variants || [{ content: existingAssistantMsg.content, timestamp: existingAssistantMsg.timestamp }];
          const updatedVariants = [...oldVariants, { content: fullContent, timestamp: Date.now() }];
          const updatedIndex = updatedVariants.length - 1;

          const updatedAssMsg: Message = {
            ...existingAssistantMsg,
            content: fullContent,
            timestamp: Date.now(),
            variants: updatedVariants,
            variantIndex: updatedIndex,
          };
          newMessages.push(updatedAssMsg);
        } else {
          const newAssMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
            variants: [{ content: fullContent, timestamp: Date.now() }],
            variantIndex: 0,
          };
          newMessages.push(newAssMsg);
        }

        return {
          ...c,
          messages: newMessages,
          updatedAt: Date.now(),
        };
      }));
    }

    setIsStreaming(false);
    setStreamingContent('');
  }, [isStreaming, activeChatId, chats, selectedModel, apiKeys, ollamaUrl, ollamaModel]);

  const handleSwitchVariant = useCallback((messageId: string, targetVariantIndex: number) => {
    if (!activeChatId) return;

    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;

      const msgIndex = c.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return c;

      const targetMsg = c.messages[msgIndex];
      if (!targetMsg.variants || !targetMsg.variants[targetVariantIndex]) return c;

      const newMessages = [...c.messages];

      // Update target message
      newMessages[msgIndex] = {
        ...targetMsg,
        variantIndex: targetVariantIndex,
        content: targetMsg.variants[targetVariantIndex].content,
      };

      // Sync user message <-> assistant message pair if applicable
      if (targetMsg.role === 'user' && msgIndex + 1 < newMessages.length && newMessages[msgIndex + 1].role === 'assistant') {
        const nextAss = newMessages[msgIndex + 1];
        if (nextAss.variants && nextAss.variants[targetVariantIndex]) {
          newMessages[msgIndex + 1] = {
            ...nextAss,
            variantIndex: targetVariantIndex,
            content: nextAss.variants[targetVariantIndex].content,
          };
        }
      } else if (targetMsg.role === 'assistant' && msgIndex - 1 >= 0 && newMessages[msgIndex - 1].role === 'user') {
        const prevUser = newMessages[msgIndex - 1];
        if (prevUser.variants && prevUser.variants[targetVariantIndex]) {
          newMessages[msgIndex - 1] = {
            ...prevUser,
            variantIndex: targetVariantIndex,
            content: prevUser.variants[targetVariantIndex].content,
          };
        }
      }

      return {
        ...c,
        messages: newMessages,
        updatedAt: Date.now(),
      };
    }));
  }, [activeChatId]);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onPinChat={handlePinChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <ChatArea
        chat={activeChat}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onSend={handleSend}
        onRegenerate={handleRegenerate}
        onEditUserMessage={handleEditUserMessage}
        onSwitchVariant={handleSwitchVariant}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onStop={handleStop}
        chatError={chatError}
        onOpenSearch={() => setSearchOpen(true)}
        onAnswerMCQ={(messageId, answer) => {
          setChats(prev => prev.map(c => {
            if (c.id !== activeChatId) return c;
            const updatedMessages = c.messages.map(m => {
              if (m.id === messageId) {
                return { ...m, mcqAnswer: answer };
              }
              return m;
            });
            return { ...c, messages: updatedMessages, updatedAt: Date.now() };
          }));
        }}
        onAnswerFlow={(messageId, flowAnswers) => {
          setChats(prev => prev.map(c => {
            if (c.id !== activeChatId) return c;
            const updatedMessages = c.messages.map(m => {
              if (m.id === messageId) {
                return { ...m, flowAnswers, isFlowCompleted: true };
              }
              return m;
            });
            return { ...c, messages: updatedMessages, updatedAt: Date.now() };
          }));
        }}
        ollamaUrl={ollamaUrl}
        ollamaModel={ollamaModel}
        onSelectOllamaModel={setOllamaModel}
        onOpenVoiceMode={() => setVoiceModalOpen(true)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onChangeTheme={handleChangeTheme}
        apiKeys={apiKeys}
        onChangeApiKeys={handleChangeApiKeys}
        ollamaUrl={ollamaUrl}
        onChangeOllamaUrl={setOllamaUrl}
        ollamaModel={ollamaModel}
        onChangeOllamaModel={setOllamaModel}
      />

      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        chats={chats}
        onSelectChat={handleSelectChat}
      />

      <VoiceModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        onSendSpeech={async (speechText) => {
          handleSend(speechText);
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              resolve("हाँ, बिल्कुल! मैं आपकी सहायता के लिए तैयार हूँ।");
            }, 1200);
          });
        }}
      />
    </div>
  );
}
