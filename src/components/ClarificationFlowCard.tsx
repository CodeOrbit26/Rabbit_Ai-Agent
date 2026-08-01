import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronLeft, ChevronRight, Send, Sparkles, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import type { ClarificationFlow, ClarificationAnswers, FlowQuestionOption, ClarificationLifecycle } from '../types';

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

  const [lifecycle, setLifecycle] = useState<ClarificationLifecycle>(
    isCompleted ? 'completed' : 'entering'
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<ClarificationAnswers>(savedAnswers || {});
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [showDetailDrawer, setShowDetailDrawer] = useState<boolean>(false);

  const currentQ = questions[currentIndex] || questions[0];
  const isMulti = currentQ?.selection === 'multi' || currentQ?.selection === 'multiple';

  const currentAns = currentQ ? answers[currentQ.id] : undefined;
  const [selectedLabels, setSelectedLabels] = useState<string[]>(currentAns?.selectedLabels || []);
  const [customText, setCustomText] = useState<string>(currentAns?.customInput || '');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(!!currentAns?.customInput);

  const customInputRef = useRef<HTMLInputElement>(null);

  // Entrance animation timer
  useEffect(() => {
    if (!isCompleted && lifecycle === 'entering') {
      const timer = setTimeout(() => setLifecycle('active'), 280);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, lifecycle]);

  // Sync selection when index or answers change
  useEffect(() => {
    if (currentQ) {
      const ans = answers[currentQ.id];
      setSelectedLabels(ans?.selectedLabels || []);
      setCustomText(ans?.customInput || '');
      setShowCustomInput(!!ans?.customInput);
    }
  }, [currentIndex, currentQ, answers]);

  // Auto-focus custom text input when toggled
  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput]);

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
      setSlideDirection('next');
      setCurrentIndex(prev => prev + 1);
      setLifecycle('active');
    } else {
      // Final completion sequence
      setLifecycle('completing');
      setTimeout(() => {
        setLifecycle('completed');
        if (onComplete) {
          const summaryParts: string[] = [];
          Object.values(finalAnswers).forEach(ans => {
            summaryParts.push(`${ans.questionText}: ${ans.selectedLabels.join(', ')}`);
          });
          onComplete(finalAnswers, summaryParts.join(' | '));
        }
      }, 350);
    }
  };

  const handleSingleClick = (label: string) => {
    if (disabled || lifecycle === 'transitioning' || lifecycle === 'completing') return;

    setLifecycle('transitioning');
    setSelectedLabels([label]);
    setShowCustomInput(false);

    const updatedAnswers = saveCurrentAnswer([label], undefined);

    // 180ms visual confirmation delay before sliding to next question
    setTimeout(() => {
      advanceStep(updatedAnswers);
    }, 180);
  };

  const handleMultiToggle = (label: string) => {
    if (disabled || lifecycle === 'transitioning' || lifecycle === 'completing') return;

    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]
    );
  };

  const handleCustomToggle = () => {
    if (disabled || lifecycle === 'transitioning' || lifecycle === 'completing') return;
    if (!isMulti) {
      setSelectedLabels([]);
    }
    setShowCustomInput(prev => !prev);
  };

  const handleMultiSubmit = () => {
    if (disabled || lifecycle === 'transitioning' || lifecycle === 'completing') return;

    const finalLabels = [...selectedLabels];
    if (showCustomInput && customText.trim()) {
      finalLabels.push(`Other: ${customText.trim()}`);
    }

    if (finalLabels.length === 0) return;

    setLifecycle('transitioning');
    const updatedAnswers = saveCurrentAnswer(finalLabels, showCustomInput ? customText.trim() : undefined);
    advanceStep(updatedAnswers);
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && lifecycle !== 'transitioning') {
      setSlideDirection('prev');
      setLifecycle('transitioning');
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setLifecycle('active');
      }, 150);
    }
  };

  // Compact Completed Summary View
  if (lifecycle === 'completed') {
    const choiceList = Object.values(answers)
      .map(a => a.selectedLabels.join(', '))
      .filter(Boolean);

    return (
      <div className="flow-compact-summary">
        <div className="flow-summary-left">
          <div className="flow-check-badge">
            <Check size={12} />
          </div>
          <span className="flow-summary-title">Preferences added:</span>
          <span className="flow-summary-chips">{choiceList.join(' · ')}</span>
        </div>

        <div className="flow-summary-actions">
          <button
            type="button"
            className="flow-expand-btn"
            onClick={() => setShowDetailDrawer(!showDetailDrawer)}
            title="View details"
          >
            {showDetailDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            className="flow-edit-btn"
            onClick={() => {
              setLifecycle('editing');
              setCurrentIndex(0);
            }}
          >
            <Pencil size={12} />
            <span>Edit</span>
          </button>
        </div>

        {/* Expandable detail drawer */}
        {showDetailDrawer && (
          <div className="flow-detail-drawer">
            {Object.values(answers).map((ans, i) => (
              <div key={i} className="flow-detail-row">
                <span className="detail-q">{ans.questionText}:</span>
                <span className="detail-a">{ans.selectedLabels.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Completing State Brief Animation
  if (lifecycle === 'completing') {
    return (
      <div className="flow-card flow-card-completing">
        <div className="flow-completing-badge">
          <div className="completing-check-circle">
            <Check size={18} />
          </div>
          <span>Preferences added!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flow-card flow-card-${lifecycle}`}>
      {/* Header & Progress Bar */}
      <div className="flow-card-header">
        <div className="flow-step-info">
          <span className="flow-step-text">
            {currentIndex + 1} of {totalQuestions}
          </span>
          <span className="flow-percent-text">{progressPercent}%</span>
        </div>
        <div className="flow-progress-bar-container">
          <div className="flow-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Outer Container Remains Stable, Inner Content Slides */}
      <div className={`flow-question-content slide-${slideDirection}`}>
        {/* Question Title */}
        <div className="flow-question-title">
          <Sparkles size={15} className="flow-q-sparkle" />
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
                disabled={disabled || lifecycle === 'transitioning'}
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
              disabled={disabled || lifecycle === 'transitioning'}
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
              ref={customInputRef}
              type="text"
              className="flow-custom-input"
              placeholder="Tell me what you have in mind..."
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              disabled={disabled || lifecycle === 'transitioning'}
              onKeyDown={e => {
                if (e.key === 'Enter' && customText.trim()) {
                  handleMultiSubmit();
                }
              }}
            />
          </div>
        )}

        {/* Footer Navigation: Only renders when controls are active */}
        {(currentIndex > 0 || isMulti || showCustomInput) && (
          <div className="flow-footer">
            {currentIndex > 0 ? (
              <button
                type="button"
                className="flow-prev-btn"
                onClick={handlePrevious}
                disabled={disabled || lifecycle === 'transitioning'}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
            ) : <div />}

            {(isMulti || showCustomInput) && (
              <button
                type="button"
                className="flow-next-btn"
                disabled={disabled || lifecycle === 'transitioning' || (selectedLabels.length === 0 && !customText.trim())}
                onClick={handleMultiSubmit}
              >
                <span>{currentIndex === totalQuestions - 1 ? 'Submit Answers' : 'Continue'}</span>
                {currentIndex === totalQuestions - 1 ? <Send size={13} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
