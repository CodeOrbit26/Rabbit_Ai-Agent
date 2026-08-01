import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, ArrowUp, AudioLines } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  hasMessages: boolean;
  chatId: string | null;
  onOpenVoiceMode?: () => void;
}

export default function MessageInput({ onSend, isStreaming, onStop, hasMessages, chatId, onOpenVoiceMode }: MessageInputProps) {
  const [value, setValue] = useState(() => {
    return localStorage.getItem(`aria_chat_draft_${chatId || 'new'}`) || '';
  });
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [welcomePlaceholder] = useState(() => {
    const welcomePlaceholders = ["Start a new chat...", "Ask anything...", "What's on your mind?"];
    return welcomePlaceholders[Math.floor(Math.random() * welcomePlaceholders.length)];
  });

  const [chatPlaceholder] = useState(() => {
    const chatPlaceholders = ["Continue the conversation...", "Type your message..."];
    return chatPlaceholders[Math.floor(Math.random() * chatPlaceholders.length)];
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Persist draft on value change
  useEffect(() => {
    if (value) {
      localStorage.setItem(`aria_chat_draft_${chatId || 'new'}`, value);
    } else {
      localStorage.removeItem(`aria_chat_draft_${chatId || 'new'}`);
    }
  }, [value, chatId]);

  const handleSend = () => {
    if (isStreaming) {
      onStop();
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    localStorage.removeItem(`aria_chat_draft_${chatId || 'new'}`);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = value.trim().length > 0;
  const isExpanded = isFocused || hasContent || isStreaming;
  const activePlaceholder = hasMessages ? chatPlaceholder : welcomePlaceholder;

  return (
    <div className="composer-wrapper">
      <div className="composer-container">
        <div 
          className={`composer ${isExpanded ? 'expanded' : ''}`}
          onClick={() => textareaRef.current?.focus()}
          style={{ cursor: 'text' }}
        >
          <button className="composer-attach-btn" title="Attach files" onClick={e => e.stopPropagation()}>
            <Plus size={20} />
          </button>
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder={activePlaceholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            rows={1}
            autoFocus
          />
          <div className="composer-right" onClick={e => e.stopPropagation()}>
            <button className="composer-voice-btn" title="Voice Mode" onClick={onOpenVoiceMode}>
              <Mic size={20} />
            </button>
            {hasContent || isStreaming ? (
              <button
                className="composer-send-btn"
                onClick={handleSend}
                title={isStreaming ? 'Stop generating' : 'Send message'}
              >
                {isStreaming ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            ) : (
              <button className="composer-send-btn idle" title="Voice Mode" onClick={onOpenVoiceMode}>
                <AudioLines size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
