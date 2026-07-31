import { useState, useRef, useEffect } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import type { Chat } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: Chat[];
  onSelectChat: (id: string) => void;
}

export default function SearchModal({ isOpen, onClose, chats, onSelectChat }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? chats.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(query.toLowerCase()))
      )
    : chats.slice(0, 10);

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <Search className="search-input-icon" size={20} />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search chats..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
        </div>
        <div className="search-results">
          {filtered.length > 0 ? (
            filtered.map(chat => (
              <div
                key={chat.id}
                className="search-result-item"
                onClick={() => { onSelectChat(chat.id); onClose(); }}
              >
                <MessageSquare className="search-result-icon" size={18} />
                <span className="search-result-text">{chat.title}</span>
              </div>
            ))
          ) : (
            <div className="search-empty">
              {query ? 'No results found' : 'No chats yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
