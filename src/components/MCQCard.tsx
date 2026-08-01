import React, { useState } from 'react';
import { Check, Send, HelpCircle } from 'lucide-react';
import type { MCQQuestion, MCQAnswer } from '../types';

interface MCQCardProps {
  question: MCQQuestion;
  answer?: MCQAnswer;
  onAnswer?: (selectedLabels: string[], selectedIds: string[], customInput?: string) => void;
  disabled?: boolean;
}

export const MCQCard: React.FC<MCQCardProps> = ({
  question,
  answer,
  onAnswer,
  disabled = false,
}) => {
  const isMulti = question.selection === 'multi';
  const isAnswered = !!answer;

  const [selectedIds, setSelectedIds] = useState<string[]>(answer?.selectedIds || []);
  const [customInput, setCustomInput] = useState<string>(answer?.customInput || '');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(!!answer?.customInput);

  const toggleOption = (id: string) => {
    if (disabled || isAnswered) return;

    if (isMulti) {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
      setShowCustomInput(false);
    }
  };

  const handleCustomToggle = () => {
    if (disabled || isAnswered) return;
    if (!isMulti) {
      setSelectedIds([]);
    }
    setShowCustomInput(prev => !prev);
  };

  const handleSubmit = () => {
    if (disabled || isAnswered || !onAnswer) return;

    const selectedLabels: string[] = [];
    const finalSelectedIds: string[] = [...selectedIds];

    question.options.forEach(opt => {
      if (finalSelectedIds.includes(opt.id)) {
        selectedLabels.push(opt.label);
      }
    });

    if (showCustomInput && customInput.trim()) {
      selectedLabels.push(`Custom: ${customInput.trim()}`);
    }

    if (selectedLabels.length === 0) return;

    onAnswer(selectedLabels, finalSelectedIds, showCustomInput ? customInput.trim() : undefined);
  };

  const handleSingleClick = (id: string, label: string) => {
    if (disabled || isAnswered || !onAnswer) return;
    if (!isMulti) {
      onAnswer([label], [id]);
    }
  };

  return (
    <div className={`mcq-card ${isAnswered ? 'mcq-card-answered' : ''}`}>
      <div className="mcq-header">
        <div className="mcq-icon">
          <HelpCircle size={18} />
        </div>
        <div className="mcq-question-text">{question.question}</div>
        {isMulti && <span className="mcq-badge">Select multiple</span>}
      </div>

      <div className="mcq-options-grid">
        {question.options.map(opt => {
          const isSelected = isAnswered
            ? answer.selectedIds.includes(opt.id)
            : selectedIds.includes(opt.id);

          return (
            <button
              key={opt.id}
              type="button"
              className={`mcq-option-btn ${isSelected ? 'selected' : ''}`}
              disabled={disabled || isAnswered}
              onClick={() => {
                if (!isMulti && !isAnswered && onAnswer) {
                  handleSingleClick(opt.id, opt.label);
                } else {
                  toggleOption(opt.id);
                }
              }}
            >
              <div className={`mcq-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
                {isSelected && <Check size={14} className="check-icon" />}
              </div>
              <span className="mcq-option-label">{opt.label}</span>
            </button>
          );
        })}

        {question.allow_custom_input && (
          <button
            type="button"
            className={`mcq-option-btn ${showCustomInput ? 'selected' : ''}`}
            disabled={disabled || isAnswered}
            onClick={handleCustomToggle}
          >
            <div className={`mcq-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
              {showCustomInput && <Check size={14} className="check-icon" />}
            </div>
            <span className="mcq-option-label">Other / Custom Answer</span>
          </button>
        )}
      </div>

      {showCustomInput && !isAnswered && (
        <div className="mcq-custom-input-box">
          <input
            type="text"
            className="mcq-custom-input"
            placeholder="Type your custom response..."
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            disabled={disabled || isAnswered}
            onKeyDown={e => {
              if (e.key === 'Enter' && customInput.trim()) {
                handleSubmit();
              }
            }}
          />
        </div>
      )}

      {isAnswered && answer.customInput && (
        <div className="mcq-custom-answer-display">
          <strong>Custom answer:</strong> {answer.customInput}
        </div>
      )}

      {!isAnswered && (isMulti || showCustomInput) && (
        <div className="mcq-footer">
          <button
            type="button"
            className="mcq-submit-btn"
            disabled={disabled || (selectedIds.length === 0 && !customInput.trim())}
            onClick={handleSubmit}
          >
            <span>Submit Selection</span>
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
