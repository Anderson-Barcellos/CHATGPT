import {
  Conversation,
  ConversationWorkspace,
  Memory,
  Message,
  SerializedConversation,
  SerializedConversationWorkspace,
  SerializedMemory,
  SerializedMessage,
} from "@/types";

function normalizeDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;

  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function serializeMessage(message: Message): SerializedMessage {
  return {
    ...message,
    timestamp: normalizeDate(message.timestamp).toISOString(),
  };
}

export function deserializeMessage(message: SerializedMessage | Message): Message {
  return {
    ...message,
    timestamp: normalizeDate(message.timestamp),
  };
}

function serializeConversationWorkspace(
  workspace: ConversationWorkspace | undefined
): SerializedConversationWorkspace | undefined {
  if (!workspace?.notes) return undefined;

  return {
    notes: {
      ...workspace.notes,
      updatedAt: normalizeDate(workspace.notes.updatedAt).toISOString(),
    },
  };
}

function deserializeConversationWorkspace(
  workspace: SerializedConversationWorkspace | ConversationWorkspace | undefined
): ConversationWorkspace | undefined {
  if (!workspace?.notes) return undefined;

  return {
    notes: {
      ...workspace.notes,
      updatedAt: normalizeDate(workspace.notes.updatedAt),
    },
  };
}

export function serializeConversation(
  conversation: Conversation
): SerializedConversation {
  return {
    ...conversation,
    messages: conversation.messages.map(serializeMessage),
    workspace: serializeConversationWorkspace(conversation.workspace),
    createdAt: normalizeDate(conversation.createdAt).toISOString(),
    updatedAt: normalizeDate(conversation.updatedAt).toISOString(),
  };
}

export function deserializeConversation(
  conversation: SerializedConversation | Conversation
): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      deserializeMessage(message as SerializedMessage | Message)
    ),
    workspace: deserializeConversationWorkspace(
      conversation.workspace as SerializedConversationWorkspace | ConversationWorkspace | undefined
    ),
    createdAt: normalizeDate(conversation.createdAt),
    updatedAt: normalizeDate(conversation.updatedAt),
  };
}

export function serializeMemory(memory: Memory): SerializedMemory {
  return {
    ...memory,
    createdAt: normalizeDate(memory.createdAt).toISOString(),
    updatedAt: normalizeDate(memory.updatedAt).toISOString(),
  };
}

export function deserializeMemory(memory: SerializedMemory | Memory): Memory {
  return {
    ...memory,
    createdAt: normalizeDate(memory.createdAt),
    updatedAt: normalizeDate(memory.updatedAt),
  };
}
