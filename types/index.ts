export type MessageRole = "user" | "assistant";
export type AppMode = "chat" | "image";
export type ResponseMode = "default" | "document" | "quiz";
export type MessageStreamStatus =
  | "streaming"
  | "completed"
  | "aborted"
  | "failed";

export interface UrlCitation {
  title: string;
  url: string;
}

export type ReasoningStatus = "thinking" | "complete";
export type ArtifactContentType = "markdown" | "html" | "mixed";
export type MessageArtifactKind = "document" | "quiz";
export type MessageArtifactDisplayMode = "default" | "document" | "quiz";

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
  responseMode?: ResponseMode;
  attachments?: FileAttachment[];
}

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
}

export interface QuizSession {
  answersByQuestionId: Record<string, string>;
  status: "draft" | "submitted";
  score?: number;
  submittedAt?: string;
}

export interface QuizArtifactPayload {
  id: string;
  title: string;
  topic: string;
  instructions: string;
  questions: QuizQuestion[];
  session: QuizSession;
}

interface BaseMessageArtifact {
  id: string;
  kind: MessageArtifactKind;
  title: string;
  summary: string;
  displayMode?: MessageArtifactDisplayMode;
}

export interface DocumentMessageArtifact extends BaseMessageArtifact {
  kind: "document";
  content: string;
  type: ArtifactContentType;
}

export interface QuizMessageArtifact extends BaseMessageArtifact {
  kind: "quiz";
  quiz: QuizArtifactPayload;
}

export type MessageArtifact = DocumentMessageArtifact | QuizMessageArtifact;

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  streamStatus?: MessageStreamStatus;
  responseMode?: ResponseMode;
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
