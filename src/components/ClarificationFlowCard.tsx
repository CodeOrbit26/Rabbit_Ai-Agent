import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Send, HelpCircle, Sparkles } from 'lucide-react';
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

  const currentQ = questions[currentIndex] || questions[0];
  const isMulti = currentQ?.selection === 'multi' || currentQ?.selection === 'multiple';

  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
  const [selectedIds, setSelectedIds] = useState<string[]>(currentAnswer?.selectedLabels || []);
  const [customText, setCustomText] = useState<string>(currentAnswer?.customInput || '');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(!!currentAnswer?.customInput);

  if (!currentQ || totalQuestions === 0) return null;

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  const saveCurrentAnswer = (newSelectedLabels: string[], newCustomText?: string) => {
    const updatedAnswers: ClarificationAnswers = {
      ...answers,
      [currentQ.id]: {
        questionId: currentQ.id,
        questionText: currentQ.question,
        selectedLabels: newSelectedLabels,
        customInput: newCustomText,
      },
    };
    setAnswers(updatedAnswers);
    return updatedAnswers;
  };

  const handleNextStep = (finalAnswers: ClarificationAnswers) => {
    if (currentIndex < totalQuestions - 1) {
      const nextIdx = currentIndex + 1;
      const nextQ = questions[nextIdx];
      const nextAns = finalAnswers[nextQ.id];
      setCurrentIndex(nextIdx);
      setSelectedIds(nextAns?.selectedLabels || []);
      setCustomText(nextAns?.customInput || '');
      setShowCustomInput(!!nextAns?.customInput);
    } else {
      // Final submission of all collected answers together
      if (onComplete && !isCompleted) {
        const summaryParts: string[] = [];
        Object.values(finalAnswers).forEach(ans => {
          const joined = ans.selectedLabels.join(', ');
          summaryParts.push(`${ans.questionText}: **${joined}**`);
        });
        const summaryText = summaryParts.join(' | ');
        onComplete(finalAnswers, summaryText);
      }
    }
  };

  const handleOptionClick = (optLabel: string, optId: string) => {
    if (disabled || isCompleted) return;

    if (isMulti) {
      setSelectedIds(prev =>
        prev.includes(optLabel) ? prev.filter(item => item !== optLabel) : [...prev, optLabel]
      );
    } else {
      // Single select: immediate smooth step forward
      const newAnswers = saveCurrentAnswer([optLabel], undefined);
      handleNextStep(newAnswers);
    }
  };

  const handleCustomToggle = () => {
    if (disabled || isCompleted) return;
    if (!isMulti) {
      setSelectedIds([]);
    }
    setShowCustomInput(prev => !prev);
  };

  const handleMultiSubmit = () => {
    if (disabled || isCompleted) return;

    const finalLabels: string[] = [...selectedIds];
    if (showCustomInput && customText.trim()) {
      finalLabels.push(`Other: ${customText.trim()}`);
    }

    if (finalLabels.length === 0) return;

    const newAnswers = saveCurrentAnswer(finalLabels, showCustomInput ? customText.trim() : undefined);
    handleNextStep(newAnswers);
  };

  const handlePreviousStep = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const prevQ = questions[prevIdx];
      const prevAns = answers[prevQ.id];
      setCurrentIndex(prevIdx);
      setSelectedIds(prevAns?.selectedLabels || []);
      setCustomText(prevAns?.customInput || '');
      setShowCustomInput(!!prevAns?.customInput);
    }
  };

  return (
    <div className={`flow-card ${isCompleted ? 'flow-card-completed' : ''}`}>
      {/* Header & Progress */}
      <div className="flow-card-header">
        <div className="flow-step-info">
          <span className="flow-step-badge">
            <Sparkles size={13} />
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {currentQ.subtitle && <span className="flow-subtitle">{currentQ.subtitle}</span>}
        </div>
        <div className="flow-progress-bar-container">
          <div className="flow-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Question Title */}
      <div className="flow-question-title">
        <HelpCircle size={18} className="flow-q-icon" />
        <span>{currentQ.question}</span>
        {isMulti && <span className="flow-multi-tag">Select all that apply</span>}
      </div>

      {/* Options Grid */}
      <div className="flow-options-grid">
        {currentQ.options.map((opt, idx) => {
          const optLabel = typeof opt === 'string' ? opt : (opt as FlowQuestionOption).label;
          const optId = typeof opt === 'string' ? `opt_${idx}` : (opt as FlowQuestionOption).id;
          const isSelected = selectedIds.includes(optLabel);

          return (
            <button
              key={optId}
              type="button"
              className={`flow-option-btn ${isSelected ? 'selected' : ''}`}
              disabled={disabled || isCompleted}
              onClick={() => handleOptionClick(optLabel, optId)}
            >
              <div className={`flow-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
                {isSelected && <Check size={13} className="check-icon" />}
              </div>
              <span className="flow-option-label">{optLabel}</span>
            </button>
          );
        })}

        {currentQ.allow_custom_input && (
          <button
            type="button"
            className={`flow-option-btn ${showCustomInput ? 'selected' : ''}`}
            disabled={disabled || isCompleted}
            onClick={handleCustomToggle}
          >
            <div className={`flow-checkbox ${isMulti ? 'checkbox-multi' : 'checkbox-single'}`}>
              {showCustomInput && <Check size={13} className="check-icon" />}
            </div>
            <span className="flow-option-label">Other / Custom Answer</span>
          </button>
        )}
      </div>

      {/* Custom Input Field */}
      {showCustomInput && !isCompleted && (
        <div className="flow-custom-box">
          <input
            type="text"
            className="flow-custom-input"
            placeholder="Type your answer..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            disabled={disabled || isCompleted}
            onKeyDown={e => {
              if (e.key === 'Enter' && customText.trim()) {
                handleMultiSubmit();
              }
            }}
          />
        </div>
      )}

      {/* Navigation Controls */}
      {!isCompleted && (
        <div className="flow-footer">
          {currentIndex > 0 ? (
            <button
              type="button"
              className="flow-prev-btn"
              onClick={handlePreviousStep}
              disabled={disabled}
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>
          ) : <div />}

          {(isMulti || showCustomInput) && (
            <button
              type="button"
              className="flow-next-btn"
              disabled={disabled || (selectedIds.length === 0 && !customText.trim())}
              onClick={handleMultiSubmit}
            >
              <span>{currentIndex === totalQuestions - 1 ? 'Complete & Submit' : 'Continue'}</span>
              {currentIndex === totalQuestions - 1 ? <Send size={14} /> : <ChevronRight size={15} />}
            </button>
          )}
        </div>
      )}

      {/* Completed Summary View */}
      {isCompleted && (
        <div className="flow-completed-summary">
          <div className="flow-completed-badge">
            <Check size={14} />
            <span>Clarification Completed</span>
          </div>
          <div className="flow-summary-grid">
            {Object.values(answers).map((ans, i) => (
              <div key={i} className="flow-summary-item">
                <span className="flow-summary-q">{ans.questionText}:</span>
                <span className="flow-summary-a">{ans.selectedLabels.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
