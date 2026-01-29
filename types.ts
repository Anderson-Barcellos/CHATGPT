

export type AppMode = 'chat' | 'image' | 'canvas';

export type Role = 'user' | 'assistant' | 'system';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  // For UI state
  isStreaming?: boolean;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  mode: AppMode;
}

export interface Memory {
  id: string;
  content: string;
  category: 'personal' | 'professional' | 'technical' | 'preference';
  isActive: boolean;
}

export interface AppSettings {
  model: string;
  reasoningEffort: ReasoningEffort;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
  contextAboutUser: string;
  responsePreferences: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gemini-3-flash-preview',
  reasoningEffort: 'medium',
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 8192,
  systemInstruction: 'You are a helpful, expert AI assistant.',
  contextAboutUser: '',
  responsePreferences: ''
};

export const MODEL_OPTIONS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, low latency' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Complex reasoning, high intelligence' },
  { id: 'gemini-2.5-flash-latest', name: 'Gemini 2.5 Flash', description: 'Balanced performance' },
];
