import type { MCQQuestion } from '../types';

export interface ParsedMCQResult {
  text: string;
  mcqQuestion: MCQQuestion | null;
}

/**
 * Parses assistant message content to detect and extract an embedded MCQ question JSON block.
 */
export function parseMCQFromContent(content: string): ParsedMCQResult {
  if (!content) return { text: '', mcqQuestion: null };

  // Try matching ```json { "type": "question" ... } ``` block
  const jsonFenceRegex = /```(?:json)?\s*(\{\s*"type"\s*:\s*"question"[\s\S]*?\})\s*```/i;
  const fenceMatch = content.match(jsonFenceRegex);

  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed && parsed.type === 'question' && Array.isArray(parsed.options)) {
        const text = content.replace(fenceMatch[0], '').trim();
        return { text, mcqQuestion: parsed as MCQQuestion };
      }
    } catch {
      // Invalid JSON, fall through
    }
  }

  // Try matching raw JSON object containing "type": "question"
  const rawJsonRegex = /(\{\s*"type"\s*:\s*"question"[\s\S]*?\})/;
  const rawMatch = content.match(rawJsonRegex);

  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[1]);
      if (parsed && parsed.type === 'question' && Array.isArray(parsed.options)) {
        const text = content.replace(rawMatch[1], '').trim();
        return { text, mcqQuestion: parsed as MCQQuestion };
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return { text: content, mcqQuestion: null };
}
