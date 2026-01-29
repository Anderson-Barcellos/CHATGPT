

export type AppMode = 'chat' | 'image' | 'canvas';

export type Role = 'user' | 'assistant' | 'system';

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
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  systemInstruction: string;
  contextAboutUser: string;
  responsePreferences: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gpt-4o-mini',
  imageModel: 'dall-e-3',
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
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Reliable reasoning and coding' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, cost-effective' }
];

export const IMAGE_MODEL_OPTIONS = [
  { id: 'dall-e-3', name: 'DALL·E 3', description: 'High quality image generation' },
  { id: 'dall-e-2', name: 'DALL·E 2', description: 'Faster image generation' }
];
