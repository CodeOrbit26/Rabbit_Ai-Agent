import React, { useState, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, Send, HelpCircle, Sparkles, Pencil } from 'lucide-react';
import type { ClarificationFlow, ClarificationAnswers, FlowQuestionOption } from '../types';

interface ClarificationFlowCardProps {
  flow: ClarificationFlow;
  savedAnswers?: ClarificationAnswers;
  isCompleted?: boolean;
  onComplete?: (answers: ClarificationAnswers, summaryText: string) => void;
  disabled?: boolean;
}

export const ClarificationFlowCard: React.FC<ClarificationFlowCardProps> = ({
  flow,
  savedAnswers,
  isCompleted = false,
  onComplete,
  disabled = false,
}) => {
  const questions = flow.questions || [];
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<ClarificationAnswers>(savedAnswers || {});
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const currentQ = questions[currentIndex] || questions[0];
  const isMulti = currentQ?.selection === 'multi' || currentQ?.selection === 'multiple';

  const currentAns = currentQ ? answers[currentQ.id] : undefined;
  const [selectedLabels, setSelectedLabels] = useState<string[]>(currentAns?.selectedLabels || []);
  const [customText, setCustomText] = useState<string>(currentAns?.customInput || '');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(!!currentAns?.customInput);

  // Sync state when step changes
  useEffect(() => {
    if (currentQ) {
      const ans = answers[currentQ.id];
      setSelectedLabels(ans?.selectedLabels || []);
      setCustomText(ans?.customInput || '');
      setShowCustomInput(!!ans?.customInput);
    }
  }, [currentIndex, currentQ, answers]);

  if (!currentQ || totalQuestions === 0) return null;

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const saveCurrentAnswer = (labelsToSave: string[], textToSave?: string) => {
    const updated: ClarificationAnswers = {
      ...answers,
      [currentQ.id]: {
        questionId: currentQ.id,
        questionText: currentQ.question,
        selectedLabels: labelsToSave,
        customInput: textToSave,
      },
    };
    setAnswers(updated);
    return updated;
  };

  const advanceStep = (finalAnswers: ClarificationAnswers) => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsTransitioning(false);
    } else {
      // Final completion
      setIsTransitioning(false);
      setIsEditing(false);
      if (onComplete) {
        const summaryParts: string[] = [];
        Object.values(finalAnswers).forEach(ans => {
          summaryParts.push(`${ans.questionText}: ${ans.selectedLabels.join(', ')}`);
        });
        const summaryText = summaryParts.join(' | ');
        onComplete(finalAnswers, summaryText);
      }
    }
  };

  const handleSingleClick = (label: string) => {
    if (disabled || isTransitioning || (isCompleted && !isEditing)) return;

    setIsTransitioning(true);
    setSelectedLabels([label]);
    setShowCustomInput(false);

    const updatedAnswers = saveCurrentAnswer([label], undefined);

    // 180ms visual confirmation delay before step transition
    setTimeout(() => {
      advanceStep(updatedAnswers);
    }, 180);
  };

  const handleMultiToggle = (label: string) => {
    if (disabled || isTransitioning || (isCompleted && !isEditing)) return;

    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const handleCustomToggle = () => {
    if (disabled || isTransitioning || (isCompleted && !isEditing)) return;
    if (!isMulti) {
      setSelectedLabels([]);
    }
    setShowCustomInput(prev => !prev);
  };

  const handleMultiSubmit = () => {
    if (disabled || isTransitioning || (isCompleted && !isEditing)) return;

    const finalLabels = [...selectedLabels];
    if (showCustomInput && customText.trim()) {
      finalLabels.push(`Other: ${customText.trim()}`);
    }

    if (finalLabels.length === 0) return;

    setIsTransitioning(true);
    const updatedAnswers = saveCurrentAnswer(finalLabels, showCustomInput ? customText.trim() : undefined);
    advanceStep(updatedAnswers);
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !isTransitioning) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Compact Summary View when completed
  if (isCompleted && !isEditing) {
    const choiceList = Object.values(answers)
      .map(a => a.selectedLabels.join(', '))
      .filter(Boolean);

    return (
      <div className="flow-compact-summary">
        <div className="flow-summary-left">
          <Sparkles size={13} className="flow-sparkle-icon" />
          <span className="flow-summary-title">Your choices:</span>
          <span className="flow-summary-chips">{choiceList.join(' · ')}</span>
        </div>
        <button
          type="button"
          className="flow-edit-btn"
          onClick={() => {
            setIsEditing(true);
            setCurrentIndex(0);
          }}
        >
          <Pencil size={12} />
          <span>Edit choices</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flow-card ${isTransitioning ? 'flow-card-transitioning' : ''}`}>
      {/* Header & Progress Bar */}
      <div className="flow-card-header">
        <div className="flow-step-info">
          <span className="flow-step-text">
            {currentIndex + 1} of {totalQuestions}
          </span>
          {currentQ.subtitle && <span className="flow-subtitle">{currentQ.subtitle}</span>}
          <span className="flow-percent-text">{progressPercent}%</span>
        </div>
        <div className="flow-progress-bar-container">
          <div className="flow-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Question Title */}
      <div className="flow-question-title">
        <HelpCircle size={16} className="flow-q-icon" />
        <span>{currentQ.question}</span>
        {isMulti && <span className="flow-multi-tag">Select all that apply</span>}
      </div>

      {/* Options Grid */}
      <div className="flow-options-grid">
        {currentQ.options.map((opt, idx) => {
          const optLabel = typeof opt === 'string' ? opt : (opt as FlowQuestionOption).label;
          const optId = typeof opt === 'string' ? `opt_${idx}` : (opt as FlowQuestionOption).id;
          const isSelected = selectedLabels.includes(optLabel);

          return (
            <button
              key={optId}
              type="button"
              className={`flow-option-btn ${isSelected ? 'selected' : ''}`}
              disabled={disabled || isTransitioning}
              onClick={() => {
                if (isMulti) {
                  handleMultiToggle(optLabel);
                } else {
                  handleSingleClick(optLabel);
                }
              }}
            >
              <div className={`flow-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
                {isSelected && <Check size={12} className="check-icon" />}
              </div>
              <span className="flow-option-label">{optLabel}</span>
            </button>
          );
        })}

        {currentQ.allow_custom_input && (
          <button
            type="button"
            className={`flow-option-btn ${showCustomInput ? 'selected' : ''}`}
            disabled={disabled || isTransitioning}
            onClick={handleCustomToggle}
          >
            <div className={`flow-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
              {showCustomInput && <Check size={12} className="check-icon" />}
            </div>
            <span className="flow-option-label">Other / Custom Answer</span>
          </button>
        )}
      </div>

      {/* Inline Custom Input */}
      {showCustomInput && (
        <div className="flow-custom-box">
          <input
            type="text"
            className="flow-custom-input"
            placeholder="Tell me what you have in mind..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            disabled={disabled || isTransitioning}
            onKeyDown={e => {
              if (e.key === 'Enter' && customText.trim()) {
                handleMultiSubmit();
              }
            }}
          />
        </div>
      )}

      {/* Footer Navigation */}
      {(currentIndex > 0 || isMulti || showCustomInput) && (
        <div className="flow-footer">
          {currentIndex > 0 ? (
            <button
              type="button"
              className="flow-prev-btn"
              onClick={handlePrevious}
              disabled={disabled || isTransitioning}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
          ) : <div />}

          {(isMulti || showCustomInput) && (
            <button
              type="button"
              className="flow-next-btn"
              disabled={disabled || isTransitioning || (selectedLabels.length === 0 && !customText.trim())}
              onClick={handleMultiSubmit}
            >
              <span>{currentIndex === totalQuestions - 1 ? 'Submit Answers' : 'Continue'}</span>
              {currentIndex === totalQuestions - 1 ? <Send size={13} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
