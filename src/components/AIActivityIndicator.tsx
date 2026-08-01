import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Check } from 'lucide-react';

interface AIActivityIndicatorProps {
  label?: string;
  details?: string[];
  isCompleted?: boolean;
}

export const AIActivityIndicator: React.FC<AIActivityIndicatorProps> = ({
  label = 'Preparing a few questions...',
  details = ['Understood your request', 'Identified key choices needed', 'Prepared questions'],
  isCompleted = false,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div className={`ai-activity-container ${isCompleted ? 'completed' : ''}`}>
      <button
        type="button"
        className="ai-activity-pill"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="ai-activity-sparkle">
          {isCompleted ? <Check size={13} /> : <Sparkles size={13} className="sparkle-spin" />}
        </span>
        <span className="ai-activity-label">{label}</span>
        <span className="ai-activity-chevron">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {expanded && details.length > 0 && (
        <div className="ai-activity-details">
          {details.map((item, idx) => (
            <div key={idx} className="ai-activity-detail-item">
              <Check size={12} className="detail-check" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
