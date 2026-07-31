import { useState, useRef, useEffect } from 'react';
import {
  Copy, ThumbsUp, ThumbsDown, RotateCcw, ImagePlus, Pencil, Globe,
  SquarePen, AlertTriangle, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { Chat, ModelId } from '../types';
import { renderMarkdown } from '../utils/markdown';
import { loadSettings } from '../utils/storage';
import ModelSelector from './ModelSelector';
import MessageInput from './MessageInput';

interface ChatAreaProps {
  chat: Chat | null;
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  onSend: (message: string) => void;
  onRegenerate: (userMessageId?: string) => void;
  onEditUserMessage: (userMessageId: string, newContent: string) => void;
  onSwitchVariant: (messageId: string, targetVariantIndex: number) => void;
  isStreaming: boolean;
  streamingContent: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onStop: () => void;
  chatError: string | null;
  onOpenSearch: () => void;
  ollamaUrl?: string;
  ollamaModel?: string;
  onSelectOllamaModel?: (model: string) => void;
}

function OpenAILogoSmall() {
  return (
    <img src="/logo.png" alt="Aria Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  );
}

function OrangeStarburst() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dd7a5f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.64" y1="5.64" x2="18.36" y2="18.36" />
      <line x1="5.64" y1="18.36" x2="18.36" y2="5.64" />
      <line x1="12" y1="12" x2="19.5" y2="7.5" />
      <line x1="12" y1="12" x2="4.5" y2="16.5" />
      <line x1="12" y1="12" x2="7.5" y2="4.5" />
      <line x1="12" y1="12" x2="16.5" y2="19.5" />
    </svg>
  );
}

function getDynamicGreeting(firstName: string): string {
  const hour = new Date().getHours();
  const useName = Math.random() < 0.5;
  const nameSuffix = useName ? `, ${firstName}` : '';

  const night = [
    'Hello, night owl',
    `Still awake${nameSuffix}?`,
    'Another late session?',
    'Midnight ideas?',
    'Back in the lab?'
  ];

  const morning = [
    `Good morning${nameSuffix}`,
    'Early start today?',
    'Ready for a fresh day?',
    `Morning inspiration${nameSuffix}`
  ];

  const afternoon = [
    'Afternoon',
    "What's next today?",
    'Making progress?',
    `Hope your day is going well${nameSuffix}`
  ];

  const evening = [
    'Good evening',
    'Winding down?',
    'Back for another idea?',
    `Evening thoughts${nameSuffix}`
  ];

  const dev = [
    'What are we building today?',
    'One more iteration?',
    'Building something interesting?',
    'Ready to create?',
    `What's next${nameSuffix}?`
  ];

  let candidates: string[];
  if (hour >= 22 || hour < 5) {
    candidates = night;
  } else if (hour >= 5 && hour < 12) {
    candidates = morning;
  } else if (hour >= 12 && hour < 18) {
    candidates = afternoon;
  } else {
    candidates = evening;
  }

  if (Math.random() < 0.3) {
    candidates = dev;
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

function formatMessageDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ChatArea({
  chat, selectedModel, onSelectModel, onSend, onRegenerate, onEditUserMessage, onSwitchVariant, isStreaming, streamingContent,
  sidebarOpen, onToggleSidebar, onNewChat, onStop, chatError, onOpenSearch,
  ollamaUrl, ollamaModel, onSelectOllamaModel
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [greeting, setGreeting] = useState(() => {
    const settings = loadSettings();
    const firstName = settings.userName ? settings.userName.split(' ')[0] : 'Abhay';
    return getDynamicGreeting(firstName);
  });

  const hasMessages = !!(chat && chat.messages.length > 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, streamingContent]);

  useEffect(() => {
    if (!hasMessages) {
      const settings = loadSettings();
      const firstName = settings.userName ? settings.userName.split(' ')[0] : 'Abhay';
      setGreeting(getDynamicGreeting(firstName));
    }
  }, [hasMessages]);

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <main className="main-content">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            ollamaUrl={ollamaUrl}
            ollamaModel={ollamaModel}
            onSelectOllamaModel={onSelectOllamaModel}
          />
        </div>
        <div className="header-right">
          <button className="header-action-btn" title="Temporary chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3c-1.2 0-2.4.6-3 1.7A3.6 3.6 0 0 0 4.6 9c-1 .6-1.7 1.8-1.5 3.2a3.6 3.6 0 0 0 2 2.8c-.1 1.2.5 2.5 1.7 3.1a3.6 3.6 0 0 0 3.4 0c.6 1.1 1.8 1.9 3.2 1.7a3.6 3.6 0 0 0 2.8-2c1.2.1 2.5-.5 3.1-1.7a3.6 3.6 0 0 0 0-3.4c1.1-.6 1.9-1.8 1.7-3.2a3.6 3.6 0 0 0-2-2.8c.1-1.2-.5-2.5-1.7-3.1A3.6 3.6 0 0 0 12 3z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat-container">
        {!hasMessages ? (
          /* Welcome screen */
          <>
            <div className="welcome-container">
              <h1 className="welcome-greeting">
                <div className="welcome-greeting-logo">
                  <img src="/logo.png" alt="Aria Logo" />
                </div>
                <span>{greeting}</span>
              </h1>
              <div className="welcome-composer-area">
                <MessageInput 
                  key={chat ? chat.id : 'new'}
                  onSend={onSend} 
                  isStreaming={isStreaming} 
                  onStop={onStop} 
                  hasMessages={hasMessages}
                  chatId={chat ? chat.id : null}
                />
                <div className="action-chips">
                  <button className="action-chip" onClick={() => onSend('Create an image')}>
                    <ImagePlus className="action-chip-icon" size={20} />
                    <span>Create an image</span>
                  </button>
                  <button className="action-chip" onClick={() => onSend('Help me write or edit something')}>
                    <Pencil className="action-chip-icon" size={20} />
                    <span>Write or edit</span>
                  </button>
                  <button className="action-chip" onClick={() => onSend('Look something up for me')}>
                    <Globe className="action-chip-icon" size={20} />
                    <span>Look something up</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Chat messages */
          <>
            <div className="chat-messages">
              <div className="chat-messages-inner">
                {chat.messages.map(msg => (
                  <div key={msg.id} className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                    <div className="message-wrapper">
                      <div className="message-content">
                        {editingMsgId === msg.id ? (
                          <div className="user-message-edit-box">
                            <textarea
                              className="user-message-edit-input"
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              rows={3}
                            />
                            <div className="user-message-edit-actions">
                              <button
                                className="edit-cancel-btn"
                                onClick={() => setEditingMsgId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="edit-submit-btn"
                                onClick={() => {
                                  if (editingText.trim()) {
                                    onEditUserMessage(msg.id, editingText.trim());
                                    setEditingMsgId(null);
                                  }
                                }}
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="message-text"
                            dangerouslySetInnerHTML={{
                              __html: msg.role === 'assistant'
                                ? renderMarkdown(msg.content)
                                : msg.content.replace(/\n/g, '<br/>')
                            }}
                          />
                        )}
                      </div>

                      {msg.role === 'user' && editingMsgId !== msg.id && (
                        <div className="user-message-meta">
                          {msg.variants && msg.variants.length > 1 && (
                            <div className="version-pagination">
                              <button
                                className="version-nav-btn"
                                disabled={(msg.variantIndex || 0) === 0}
                                onClick={() => onSwitchVariant(msg.id, (msg.variantIndex || 0) - 1)}
                                title="Previous version"
                              >
                                <ChevronLeft size={13} />
                              </button>
                              <span className="version-indicator">
                                {(msg.variantIndex || 0) + 1}/{msg.variants.length}
                              </span>
                              <button
                                className="version-nav-btn"
                                disabled={(msg.variantIndex || 0) === msg.variants.length - 1}
                                onClick={() => onSwitchVariant(msg.id, (msg.variantIndex || 0) + 1)}
                                title="Next version"
                              >
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          )}
                          <span className="message-timestamp">
                            {formatMessageDate(msg.timestamp || Date.now())}
                          </span>
                          <div className="user-message-actions">
                            <button
                              className="message-action-btn"
                              onClick={() => onRegenerate(msg.id)}
                              title="Retry prompt"
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              className="message-action-btn"
                              onClick={() => {
                                setEditingMsgId(msg.id);
                                setEditingText(msg.content);
                              }}
                              title="Edit prompt"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="message-action-btn"
                              onClick={() => handleCopyMessage(msg.content)}
                              title="Copy text"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.role === 'assistant' && (
                        <div className="message-actions">
                          {msg.variants && msg.variants.length > 1 && (
                            <div className="version-pagination">
                              <button
                                className="version-nav-btn"
                                disabled={(msg.variantIndex || 0) === 0}
                                onClick={() => onSwitchVariant(msg.id, (msg.variantIndex || 0) - 1)}
                                title="Previous version"
                              >
                                <ChevronLeft size={13} />
                              </button>
                              <span className="version-indicator">
                                {(msg.variantIndex || 0) + 1}/{msg.variants.length}
                              </span>
                              <button
                                className="version-nav-btn"
                                disabled={(msg.variantIndex || 0) === msg.variants.length - 1}
                                onClick={() => onSwitchVariant(msg.id, (msg.variantIndex || 0) + 1)}
                                title="Next version"
                              >
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          )}
                          <button className="message-action-btn" onClick={() => handleCopyMessage(msg.content)} title="Copy">
                            <Copy size={16} />
                          </button>
                          <button className="message-action-btn" title="Good response">
                            <ThumbsUp size={16} />
                          </button>
                          <button className="message-action-btn" title="Bad response">
                            <ThumbsDown size={16} />
                          </button>
                          <button className="message-action-btn" title="Regenerate" onClick={() => onRegenerate()}>
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <div className="message message-assistant">
                    <div className="message-content">
                      <div className="message-text">
                        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                        <span className="streaming-cursor" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Typing indicator */}
                {isStreaming && !streamingContent && (
                  <div className="message message-assistant">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                {chatError && (
                  <div className="message message-error-bubble">
                    <div className="message-content">
                      <div className="message-text error-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(chatError) }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
            <MessageInput 
              key={chat ? chat.id : 'new'}
              onSend={onSend} 
              isStreaming={isStreaming} 
              onStop={onStop} 
              hasMessages={hasMessages}
              chatId={chat ? chat.id : null}
            />
          </>
        )}
      </div>
    </main>
  );
}
