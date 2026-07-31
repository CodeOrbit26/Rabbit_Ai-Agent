import { useState } from 'react';
import {
  X, Settings, Bell, Sparkles, Puzzle, AudioLines, CreditCard,
  Database, HardDrive, Shield, Lock, Users, UserCircle, Keyboard,
  Check, ChevronDown, Cpu
} from 'lucide-react';
import type { Theme, ApiKeys } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  apiKeys: ApiKeys;
  onChangeApiKeys: (keys: ApiKeys) => void;
  ollamaUrl: string;
  onChangeOllamaUrl: (url: string) => void;
  ollamaModel: string;
  onChangeOllamaModel: (model: string) => void;
}

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'personalization', label: 'Personalization', icon: Sparkles },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'data', label: 'Data controls', icon: Database },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'security', label: 'Security and login', icon: Lock },
  { id: 'parental', label: 'Parental controls', icon: Users },
  { id: 'trusted', label: 'Trusted contact', icon: UserCircle },
  { id: 'account', label: 'Account', icon: UserCircle },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'aikeys', label: 'AI Keys', icon: Sparkles },
  { id: 'ollama', label: 'Local Ollama', icon: Cpu },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SettingsModal({
  isOpen, onClose, theme, onChangeTheme, apiKeys, onChangeApiKeys,
  ollamaUrl, onChangeOllamaUrl, ollamaModel, onChangeOllamaModel
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [showAppearanceDropdown, setShowAppearanceDropdown] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [higherIntelligence, setHigherIntelligence] = useState(true);

  if (!isOpen) return null;

  const themeLabel = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System';

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="settings-sidebar">
          <button className="settings-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="tab-icon" size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="settings-main">
          {activeTab === 'general' && (
            <>
              <h2 className="settings-title">General</h2>

              {/* MFA Banner */}
              {showBanner && (
                <div className="settings-banner">
                  <button className="settings-banner-close" onClick={() => setShowBanner(false)}>
                    <X size={16} />
                  </button>
                  <div className="settings-banner-icon">
                    <Shield size={28} />
                  </div>
                  <div className="settings-banner-title">Secure your account</div>
                  <div className="settings-banner-text">
                    Add multi-factor authentication (MFA), like a text message or authenticator app, to help protect your account when logging in.
                  </div>
                  <button className="settings-banner-btn">Set up MFA</button>
                </div>
              )}

              {/* Appearance */}
              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-row-label">Appearance</span>
                  <div style={{ position: 'relative' }}>
                    <button
                      className="settings-dropdown"
                      onClick={() => setShowAppearanceDropdown(!showAppearanceDropdown)}
                    >
                      <span>{themeLabel}</span>
                      <ChevronDown className="dropdown-chevron" size={14} />
                    </button>
                    {showAppearanceDropdown && (
                      <>
                        <div className="dropdown-overlay" onClick={() => setShowAppearanceDropdown(false)} />
                        <div className="settings-dropdown-menu">
                          {(['system', 'dark', 'light'] as Theme[]).map(t => (
                            <button
                              key={t}
                              className="settings-dropdown-option"
                              onClick={() => { onChangeTheme(t); setShowAppearanceDropdown(false); }}
                            >
                              <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                              {theme === t && <Check className="check" size={16} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Contrast */}
              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-row-label">Contrast</span>
                  <button className="settings-dropdown">
                    <span>System</span>
                    <ChevronDown className="dropdown-chevron" size={14} />
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-row-label">Accent color</span>
                  <button className="settings-dropdown">
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--text-primary)', display: 'inline-block', marginRight: 6
                    }} />
                    <span>Default</span>
                    <ChevronDown className="dropdown-chevron" size={14} />
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className="settings-section">
                <div className="settings-row">
                  <span className="settings-row-label">Language</span>
                  <button className="settings-dropdown">
                    <span>Auto-detect</span>
                    <ChevronDown className="dropdown-chevron" size={14} />
                  </button>
                </div>
              </div>

              {/* Higher intelligence */}
              <div className="settings-section">
                <div className="settings-row">
                  <div>
                    <div className="settings-row-label">Higher intelligence</div>
                    <div className="settings-row-desc">
                      Aria can automatically use a higher intelligence setting when you ask a complex question.
                    </div>
                  </div>
                  <button
                    className={`toggle-switch ${higherIntelligence ? 'on' : ''}`}
                    onClick={() => setHigherIntelligence(!higherIntelligence)}
                  />
                </div>
              </div>

              {/* Enable Dictation */}
              <div className="settings-section">
                <div className="settings-row">
                  <div>
                    <div className="settings-row-label">Enable Dictation</div>
                  </div>
                  <button className={`toggle-switch`} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'aikeys' && (
            <>
              <h2 className="settings-title">AI Keys</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Add your API keys to enable real AI responses. Keys are stored locally in your browser only.
              </p>

              <div className="settings-key-input-group">
                <label className="settings-key-label">Gemini API Key</label>
                <input
                  type="password"
                  className="settings-key-input"
                  placeholder="Enter your Gemini API key"
                  value={apiKeys.gemini}
                  onChange={e => onChangeApiKeys({ ...apiKeys, gemini: e.target.value })}
                />
                <div className="settings-key-hint">
                  Get your key from{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
                    Google AI Studio
                  </a>
                </div>
              </div>

              <div className="settings-key-input-group">
                <label className="settings-key-label">OpenAI API Key</label>
                <input
                  type="password"
                  className="settings-key-input"
                  placeholder="Enter your OpenAI API key"
                  value={apiKeys.openai}
                  onChange={e => onChangeApiKeys({ ...apiKeys, openai: e.target.value })}
                />
                <div className="settings-key-hint">
                  Get your key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>
                    OpenAI Platform
                  </a>
                </div>
              </div>
            </>
          )}

          {activeTab === 'ollama' && (
            <>
              <h2 className="settings-title">Local Ollama</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Configure your locally running high-power Ollama models. The application will connect directly to your local instance from the browser.
              </p>

              <div className="settings-key-input-group">
                <label className="settings-key-label">Ollama API Base URL</label>
                <input
                  type="text"
                  className="settings-key-input"
                  placeholder="e.g. http://localhost:11434"
                  value={ollamaUrl}
                  onChange={e => onChangeOllamaUrl(e.target.value)}
                />
                <div className="settings-key-hint">
                  Default is <code>http://localhost:11434</code>
                </div>
              </div>

              <div className="settings-key-input-group">
                <label className="settings-key-label">Model Name</label>
                <input
                  type="text"
                  className="settings-key-input"
                  placeholder="e.g. llama3, deepseek-coder, mistral"
                  value={ollamaModel}
                  onChange={e => onChangeOllamaModel(e.target.value)}
                />
                <div className="settings-key-hint">
                  Make sure you have pulled the model (e.g. run <code>ollama run {ollamaModel || 'llama3'}</code> in your terminal)
                </div>
              </div>
            </>
          )}

          {activeTab !== 'general' && activeTab !== 'aikeys' && activeTab !== 'ollama' && (
            <>
              <h2 className="settings-title">{TABS.find(t => t.id === activeTab)?.label}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                This section is available in the full version.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
