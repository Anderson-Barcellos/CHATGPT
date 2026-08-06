export type StudioFileLanguage =
  | "typescript"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext";

export interface StudioFile {
  path: string;
  name: string;
  language: StudioFileLanguage;
  content: string;
}

export type StudioAssistantRole = "user" | "assistant";
export type StudioAssistantMessageStatus =
  | "completed"
  | "streaming"
  | "interrupted"
  | "failed";

export interface StudioAssistantMessage {
  id: string;
  role: StudioAssistantRole;
  content: string;
  createdAt: string;
  status: StudioAssistantMessageStatus;
}

export interface StudioWorkspaceSnapshot {
  version: 1;
  files: Record<string, StudioFile>;
  openFilePaths: string[];
  activeFilePath: string;
  assistantMessages: StudioAssistantMessage[];
  selectedModelId: string;
}

export type StudioConsoleLevel = "command" | "log" | "info" | "warn" | "error";

export interface StudioConsoleEntry {
  id: string;
  level: StudioConsoleLevel;
  text: string;
}

export interface StudioRunResult {
  status: "completed" | "failed" | "timeout" | "aborted";
  durationMs: number;
  entries: StudioConsoleEntry[];
}
