export type MessageRole = "user" | "assistant";
export type AppMode = "chat" | "image";

export interface UrlCitation {
  title: string;
  url: string;
}

export type ReasoningStatus = "thinking" | "complete";
export type ArtifactContentType = "markdown" | "html" | "mixed";
export type MessageArtifactKind = "document";
export type MessageArtifactDisplayMode = "default" | "document";

export type FileAttachmentType = "image" | "pdf" | "text";

export interface FileAttachment {
  id: string;
  name: string;
  type: FileAttachmentType;
  mimeType: string;
  size: number;
  dataUrl?: string;
  extractedText?: string;
  thumbnailUrl?: string;
}

export interface SendMessageOptions {
  documentMode?: boolean;
  attachments?: FileAttachment[];
}

export interface MessageArtifact {
  id: string;
  kind: MessageArtifactKind;
  title: string;
  summary: string;
  content: string;
  type: ArtifactContentType;
  displayMode?: MessageArtifactDisplayMode;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  preferredDisplayMode?: MessageArtifactDisplayMode;
  reasoningSummary?: string;
  reasoningText?: string;
  reasoningStatus?: ReasoningStatus;
  imageBase64?: string;
  imageMimeType?: string;
  isGeneratingImage?: boolean;
  isSearching?: boolean;
  citations?: UrlCitation[];
  artifact?: MessageArtifact;
  attachments?: FileAttachment[];
}

export interface SerializedMessage extends Omit<Message, "timestamp"> {
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedConversation
  extends Omit<Conversation, "messages" | "createdAt" | "updatedAt"> {
  messages: SerializedMessage[];
  createdAt: string;
  updatedAt: string;
}

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
export type ReasoningSummary = "off" | "auto" | "concise" | "detailed";
export type ResponseVerbosity = "low" | "medium" | "high";

export interface ModelScopedParameters {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  reasoningEffort: ReasoningEffort;
  reasoningSummary: ReasoningSummary;
  verbosity: ResponseVerbosity;
  codeInterpreterEnabled: boolean;
}

export interface ModelParameters extends ModelScopedParameters {
  model: string;
  systemPrompt: string;
}

export interface CustomInstructions {
  id: string;
  contextAboutUser: string;
  responsePreferences: string;
  customSystemInstructions?: string;
}

export type MemoryCategory =
  | "personal"
  | "professional"
  | "preferences"
  | "projects"
  | "technical"
  | "other";

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedMemory extends Omit<Memory, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

export const MEMORY_CATEGORIES: Record<MemoryCategory, string> = {
  personal: "Pessoal",
  professional: "Profissional",
  preferences: "Preferências",
  projects: "Projetos",
  technical: "Técnico",
  other: "Outros",
};

export type ModelCapability =
  | "chat"
  | "reasoning"
  | "vision"
  | "function-calling"
  | "json-mode"
  | "image-generation";

export type ModelFamily =
  | "gpt-4.1"
  | "o-series"
  | "gpt-4o"
  | "gpt-5"
  | "gpt-5.1"
  | "dall-e"
  | "gpt-image";

export interface ModelPricing {
  input: number;
  output: number;
  cachedInput?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  family: ModelFamily;
  description: string;
  contextWindow: number;
  maxOutput: number;
  pricing: ModelPricing;
  capabilities: ModelCapability[];
  supportsStreaming: boolean;
  supportsSystemMessages: boolean;
  supportsTemperature: boolean;
  supportsVerbosity: boolean;
  supportsCodeInterpreter: boolean;
  recommendedFor: string[];
  badge?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  totalCost: number;
}

export interface ModelRecommendation {
  modelId: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}
