import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Cpu } from 'lucide-react';
import type { ModelId } from '../types';
import { MODELS } from '../types';
import { fetchOllamaModels } from '../utils/ai';

interface ModelSelectorProps {
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  ollamaUrl?: string;
  ollamaModel?: string;
  onSelectOllamaModel?: (model: string) => void;
}

export default function ModelSelector({
  selectedModel,
  onSelectModel,
  ollamaUrl = 'http://localhost:11434',
  ollamaModel = 'llama3',
  onSelectOllamaModel,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localOllamaModels, setLocalOllamaModels] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOllamaModels(ollamaUrl).then(models => {
      if (models && models.length > 0) {
        setLocalOllamaModels(models);
      }
    });
  }, [ollamaUrl, isOpen]);

  // Compute display name
  let displayName = 'Auto';
  if (selectedModel === 'ollama') {
    displayName = ollamaModel ? `Ollama (${ollamaModel})` : 'Local Ollama';
  } else {
    displayName = MODELS.find(m => m.id === selectedModel)?.name || 'Auto';
  }

  const geminiModels = MODELS.filter(m => m.category === 'Google Gemini');
  const openAiModels = MODELS.filter(m => m.category === 'OpenAI');

  return (
    <div className="model-selector" ref={containerRef}>
      <button className="model-selector-btn" onClick={() => setIsOpen(!isOpen)}>
        <span>{displayName}</span>
        <ChevronDown className={`chevron ${isOpen ? 'open' : ''}`} size={16} />
      </button>

      {isOpen && (
        <>
          <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
          <div className="model-dropdown">
            {/* Google Gemini Section */}
            <div className="model-section-header">Google Gemini</div>
            {geminiModels.map(model => (
              <button
                key={model.id}
                className={`model-dropdown-item ${selectedModel === model.id ? 'active' : ''}`}
                onClick={() => { onSelectModel(model.id); setIsOpen(false); }}
              >
                <div className="model-item-info">
                  <div className="model-item-name">{model.name}</div>
                  <div className="model-item-desc">{model.description}</div>
                </div>
                {selectedModel === model.id && <Check className="model-item-check" size={18} />}
              </button>
            ))}

            {/* OpenAI Section */}
            <div className="model-section-header">OpenAI</div>
            {openAiModels.map(model => (
              <button
                key={model.id}
                className={`model-dropdown-item ${selectedModel === model.id ? 'active' : ''}`}
                onClick={() => { onSelectModel(model.id); setIsOpen(false); }}
              >
                <div className="model-item-info">
                  <div className="model-item-name">{model.name}</div>
                  <div className="model-item-desc">{model.description}</div>
                </div>
                {selectedModel === model.id && <Check className="model-item-check" size={18} />}
              </button>
            ))}

            {/* Local Ollama Models Section */}
            <div className="model-section-header flex-between">
              <span>Local Models (Ollama)</span>
              {localOllamaModels.length > 0 && (
                <span className="section-badge">{localOllamaModels.length} detected</span>
              )}
            </div>

            {localOllamaModels.length > 0 ? (
              localOllamaModels.map(mName => {
                const isSelected = selectedModel === 'ollama' && ollamaModel === mName;
                return (
                  <button
                    key={mName}
                    className={`model-dropdown-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      onSelectModel('ollama');
                      if (onSelectOllamaModel) onSelectOllamaModel(mName);
                      setIsOpen(false);
                    }}
                  >
                    <div className="model-item-info">
                      <div className="model-item-name flex-align-gap">
                        <Cpu size={14} className="ollama-icon" />
                        <span>{mName}</span>
                      </div>
                      <div className="model-item-desc">Installed local Ollama model</div>
                    </div>
                    {isSelected && <Check className="model-item-check" size={18} />}
                  </button>
                );
              })
            ) : (
              <button
                className={`model-dropdown-item ${selectedModel === 'ollama' ? 'active' : ''}`}
                onClick={() => { onSelectModel('ollama'); setIsOpen(false); }}
              >
                <div className="model-item-info">
                  <div className="model-item-name">Local Ollama</div>
                  <div className="model-item-desc">Run locally on default Ollama model ({ollamaModel})</div>
                </div>
                {selectedModel === 'ollama' && <Check className="model-item-check" size={18} />}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
