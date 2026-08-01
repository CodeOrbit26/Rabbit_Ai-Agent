export interface MCQOption {
  id: string;
  label: string;
}

export interface MCQQuestion {
  type: 'question';
  question: string;
  selection?: 'single' | 'multi' | 'multiple';
  options: MCQOption[];
  allow_custom_input?: boolean;
}

export interface MCQAnswer {
  selectedIds: string[];
  selectedLabels: string[];
  customInput?: string;
}

export interface FlowQuestionOption {
  id: string;
  label: string;
}

export interface FlowQuestion {
  id: string;
  question: string;
  subtitle?: string;
  selection?: 'single' | 'multi' | 'multiple';
  options: (string | FlowQuestionOption)[];
  allow_custom_input?: boolean;
}

export interface ClarificationFlow {
  type: 'clarification_flow';
  title?: string;
  questions: FlowQuestion[];
}

export interface ClarificationAnswers {
  [questionId: string]: {
    questionId: string;
    questionText: string;
    selectedLabels: string[];
    customInput?: string;
  };
}

export type ClarificationLifecycle =
  | 'pending'
  | 'entering'
  | 'active'
  | 'transitioning'
  | 'completing'
  | 'completed'
  | 'editing';

export interface MessageVariant {
  content: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mcqAnswer?: MCQAnswer;
  flowAnswers?: ClarificationAnswers;
  isFlowCompleted?: boolean;
  variants?: MessageVariant[];
  variantIndex?: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface ApiKeys {
  gemini: string;
  openai: string;
}

export type Theme = 'light' | 'dark' | 'system';
export type ModelId = 'auto' | 'gemini-3.6-flash' | 'gemini-3.5-pro' | 'gemini-2.0-flash' | 'gemini-flash' | 'gemini-pro' | 'gpt-4o' | 'gpt-4o-mini' | 'ollama';

export interface ModelOption {
  id: ModelId;
  name: string;
  provider: 'gemini' | 'openai' | 'ollama';
  description: string;
  category: 'Google Gemini' | 'OpenAI' | 'Local Ollama';
}

export const MODELS: ModelOption[] = [
  { id: 'auto', name: 'Auto (Gemini 3.6 Flash)', provider: 'gemini', description: 'Best default model for tasks', category: 'Google Gemini' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'gemini', description: 'Next-gen ultra fast Flash model', category: 'Google Gemini' },
  { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', provider: 'gemini', description: 'Advanced reasoning Pro model', category: 'Google Gemini' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', description: 'Fast and balanced', category: 'Google Gemini' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable OpenAI model', category: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', description: 'Fast and affordable', category: 'OpenAI' },
  { id: 'ollama', name: 'Local Ollama', provider: 'ollama', description: 'Run locally on your machine', category: 'Local Ollama' },
];

export interface AppSettings {
  theme: Theme;
  selectedModel: ModelId;
  userName: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}
