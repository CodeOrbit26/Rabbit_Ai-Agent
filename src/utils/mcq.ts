import type { MCQQuestion, ClarificationFlow, FlowQuestion } from '../types';

export interface ParsedPayloadResult {
  text: string;
  mcqQuestion: MCQQuestion | null;
  clarificationFlow: ClarificationFlow | null;
  isPlanning: boolean;
  activityText?: string;
}

/**
 * Standardize options array so simple string options ["Option A", "Option B"]
 * become [{ id: "option_a", label: "Option A" }].
 */
export function normalizeFlowQuestion(q: any, idx: number): FlowQuestion {
  const qId = q.id || `q_${idx + 1}`;
  const options = Array.isArray(q.options)
    ? q.options.map((opt: any, oIdx: number) => {
        if (typeof opt === 'string') {
          const optId = opt.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `opt_${oIdx + 1}`;
          return { id: optId, label: opt };
        } else if (opt && typeof opt === 'object') {
          return { id: opt.id || `opt_${oIdx + 1}`, label: opt.label || opt.id || `Option ${oIdx + 1}` };
        }
        return { id: `opt_${oIdx + 1}`, label: String(opt) };
      })
    : [];

  return {
    id: qId,
    question: q.question || 'Please clarify your requirement:',
    subtitle: q.subtitle || q.description,
    selection: (q.selection === 'multi' || q.selection === 'multiple') ? 'multi' : 'single',
    options,
    allow_custom_input: q.allow_custom_input !== false,
  };
}

/**
 * Parses assistant message content to detect and extract embedded MCQ or ClarificationFlow JSON blocks.
 * Filters out raw JSON during streaming so users never see unparsed JSON / HTML code blocks.
 */
export function parsePayloadFromContent(content: string): ParsedPayloadResult {
  if (!content) {
    return { text: '', mcqQuestion: null, clarificationFlow: null, isPlanning: false };
  }

  // Detect if streaming is currently outputting a JSON block
  const hasJsonStart = /```(?:json)?\s*\{\s*"type"\s*:\s*"(?:clarification_flow|question)"/i.test(content) ||
                       /\{\s*"type"\s*:\s*"(?:clarification_flow|question)"/i.test(content);

  // 1. Match complete ```json { ... } ``` code blocks
  const jsonFenceRegex = /```(?:json)?\s*(\{\s*"type"\s*:\s*"(?:clarification_flow|question)"[\s\S]*?\})\s*```/i;
  const fenceMatch = content.match(jsonFenceRegex);

  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed && parsed.type === 'clarification_flow' && Array.isArray(parsed.questions)) {
        const text = content.replace(fenceMatch[0], '').trim();
        const flow: ClarificationFlow = {
          type: 'clarification_flow',
          title: parsed.title,
          questions: parsed.questions.map((q: any, idx: number) => normalizeFlowQuestion(q, idx)),
        };
        return { text, mcqQuestion: null, clarificationFlow: flow, isPlanning: false };
      } else if (parsed && parsed.type === 'question' && Array.isArray(parsed.options)) {
        const text = content.replace(fenceMatch[0], '').trim();
        return { text, mcqQuestion: parsed as MCQQuestion, clarificationFlow: null, isPlanning: false };
      }
    } catch {
      // Incomplete JSON
    }
  }

  // 2. Match complete raw JSON object
  const rawJsonRegex = /(\{\s*"type"\s*:\s*"(?:clarification_flow|question)"[\s\S]*?\})/;
  const rawMatch = content.match(rawJsonRegex);

  if (rawMatch) {
    try {
      const parsed = JSON.parse(rawMatch[1]);
      if (parsed && parsed.type === 'clarification_flow' && Array.isArray(parsed.questions)) {
        const text = content.replace(rawMatch[1], '').trim();
        const flow: ClarificationFlow = {
          type: 'clarification_flow',
          title: parsed.title,
          questions: parsed.questions.map((q: any, idx: number) => normalizeFlowQuestion(q, idx)),
        };
        return { text, mcqQuestion: null, clarificationFlow: flow, isPlanning: false };
      } else if (parsed && parsed.type === 'question' && Array.isArray(parsed.options)) {
        const text = content.replace(rawMatch[1], '').trim();
        return { text, mcqQuestion: parsed as MCQQuestion, clarificationFlow: null, isPlanning: false };
      }
    } catch {
      // Incomplete JSON
    }
  }

  // 3. Mid-stream JSON detection: suppress raw JSON output & return planning status
  if (hasJsonStart) {
    // Strip the trailing JSON fragment from text output
    const cleanText = content.replace(/```(?:json)?[\s\S]*$/i, '').replace(/\{\s*"type"\s*:[\s\S]*$/i, '').trim();
    return {
      text: cleanText,
      mcqQuestion: null,
      clarificationFlow: null,
      isPlanning: true,
      activityText: '✦ Figuring out what details are needed...',
    };
  }

  return { text: content, mcqQuestion: null, clarificationFlow: null, isPlanning: false };
}

// Backward compatibility alias
export function parseMCQFromContent(content: string) {
  const res = parsePayloadFromContent(content);
  return { text: res.text, mcqQuestion: res.mcqQuestion };
}
