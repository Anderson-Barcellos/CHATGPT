

export type AppMode = 'chat' | 'image' | 'canvas';

export type Role = 'user' | 'assistant' | 'system';

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | 'none';

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
  imageModel?: string;
  reasoningEffort: ReasoningEffort;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
  contextAboutUser: string;
  responsePreferences: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gpt-4o-mini',
  imageModel: 'gpt-image-1',
  reasoningEffort: 'medium',
  temperature: 0.7,
  topP: 0.95,
  maxOutputTokens: 2048,
  systemInstruction: 'You are a helpful, expert AI assistant.',
  contextAboutUser: '',
  responsePreferences: ''
};

export const MODEL_OPTIONS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', description: 'Fast, low latency' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal, balanced performance' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Reliable reasoning and coding' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, cost-effective' },
];

export const IMAGE_MODEL_OPTIONS = [
  { id: 'gpt-image-1', name: 'GPT Image 1', description: 'High quality image generation' },
  { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini', description: 'Faster image generation' },
  { id: 'dall-e-3', name: 'DALL·E 3', description: 'Creative image generation' }
];
