export type ConversationLifecycle = "active" | "archived";

export type MemoryTopicState = "active" | "archived";

export type MemoryFactState =
  | "current"
  | "superseded"
  | "conflicted"
  | "archived"
  | "removed";

export type MemorySensitivity = "standard" | "personal" | "sensitive";

export type MemoryJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type MemoryOperationStatus =
  | "proposed"
  | "applied"
  | "review"
  | "rejected"
  | "rolled_back";
