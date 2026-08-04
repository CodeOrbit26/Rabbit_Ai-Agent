import { useState, useRef, useEffect } from 'react';
import {
  SquarePen, Search, FolderClosed, Clock, ChevronRight, Sparkles, Settings,
  LogOut, User, CircleHelp, Pencil, Trash2, Pin, Copy as CopyIcon
} from 'lucide-react';
import type { Chat } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, title: string) => void;
  onPinChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}

function OpenAILogo() {
  return (
    <img src="/logo.png" alt="Qova Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
  );
}

export default function Sidebar({
  isOpen, onToggle, chats, activeChatId, onSelectChat, onNewChat,
  onDeleteChat, onRenameChat, onPinChat, onOpenSettings, onOpenSearch
}: SidebarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const pinnedChats = chats.filter(c => c.pinned);
  const recentChats = chats.filter(c => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleStartRename = (chat: Chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  };

  const handleFinishRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameChat(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishRename();
    if (e.key === 'Escape') setRenamingId(null);
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-wrapper" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo-icon">
            <OpenAILogo />
          </div>
          {isOpen && (
            <div className="sidebar-brand-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Qova</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.2px' }}>QuantaForge AI</span>
            </div>
          )}
          <div className="sidebar-toggle-icon-collapsed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button className="sidebar-toggle-btn" onClick={onOpenSearch} title="Search chats">
            <Search size={18} />
          </button>
          <button className="sidebar-toggle-btn" onClick={onToggle} title="Close sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button className="sidebar-nav-item active" onClick={onNewChat}>
          <SquarePen className="nav-icon" size={18} />
          <span>New chat</span>
        </button>
        <button className="sidebar-nav-item">
          <FolderClosed className="nav-icon" size={18} />
          <span>Projects</span>
        </button>
        <button className="sidebar-nav-item">
          <Clock className="nav-icon" size={18} />
          <span>Scheduled</span>
        </button>
      </nav>

      {/* Pinned chats */}
      {pinnedChats.length > 0 && (
        <>
          <div className="sidebar-section">
            <div className="sidebar-section-title">Pinned</div>
          </div>
          <div className="sidebar-chats" style={{ flex: 'none', maxHeight: '120px' }}>
            {pinnedChats.map(chat => (
              <div
                key={chat.id}
                className={`chat-list-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => onSelectChat(chat.id)}
              >
                <Pin className="pinned-icon" size={16} style={{ transform: 'rotate(45deg)' }} />
                <span className="chat-item-title">{chat.title}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent chats */}
      {recentChats.length > 0 && (
        <>
          <div className="sidebar-section">
            <div className="sidebar-section-title">Recents</div>
          </div>
          <div className="sidebar-chats">
            {recentChats.map(chat => (
              <div
                key={chat.id}
                className={`chat-list-item ${activeChatId === chat.id ? 'active' : ''}`}
                onClick={() => !renamingId && onSelectChat(chat.id)}
              >
                {renamingId === chat.id ? (
                  <input
                    ref={renameInputRef}
                    className="rename-input"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="chat-item-title">{chat.title}</span>
                    <div className="chat-item-fade" />
                    <div className="chat-item-actions">
                      <button
                        className="chat-item-action-btn"
                        onClick={e => { e.stopPropagation(); handleStartRename(chat); }}
                        title="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="chat-item-action-btn"
                        onClick={e => { e.stopPropagation(); onDeleteChat(chat.id); }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Spacer */}
      {pinnedChats.length === 0 && recentChats.length === 0 && <div style={{ flex: 1 }} />}

      {/* Bottom user section */}
      <div className="sidebar-bottom">
        <div className="sidebar-user" ref={profileMenuRef}>
          <div onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}>
            <div className="user-avatar">AG</div>
            <div className="user-info">
              <div className="user-name">Abhay Gupta</div>
              <div className="user-plan">Go</div>
            </div>
          </div>
          <button className="sidebar-operator-btn" title="Operator">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          {/* Profile popup */}
          {showProfileMenu && (
            <>
              <div className="profile-popup-overlay" onClick={() => setShowProfileMenu(false)} />
              <div className="profile-popup">
                <div className="profile-popup-header">
                  <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>AG</div>
                  <div className="profile-popup-header-info">
                    <div className="profile-popup-header-name">Abhay Gupta</div>
                    <div className="profile-popup-header-plan">Go</div>
                  </div>
                  <ChevronRight className="profile-popup-chevron" size={16} />
                </div>
                <button className="profile-popup-item">
                  <Sparkles className="popup-icon" size={18} />
                  <span>Upgrade plan</span>
                </button>
                <button className="profile-popup-item">
                  <svg className="popup-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
                  <span>Personalization</span>
                </button>
                <button className="profile-popup-item">
                  <User className="popup-icon" size={18} />
                  <span>Profile</span>
                </button>
                <button className="profile-popup-item" onClick={() => { setShowProfileMenu(false); onOpenSettings(); }}>
                  <Settings className="popup-icon" size={18} />
                  <span>Settings</span>
                </button>
                <div className="profile-popup-divider" />
                <button className="profile-popup-item">
                  <CircleHelp className="popup-icon" size={18} />
                  <span>Help</span>
                  <ChevronRight className="popup-chevron" size={16} />
                </button>
                <button className="profile-popup-item">
                  <LogOut className="popup-icon" size={18} />
                  <span>Log out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
