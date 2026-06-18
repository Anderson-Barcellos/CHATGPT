import { createHash } from "crypto";
import type { Conversation, Message } from "@/types";

export interface ConversationChunk {
  id: string;
  conversationId: string;
  conversationTitle: string;
  messageIds: string[];
  chunkText: string;
  embeddingText: string;
  roleSpan: string;
  timestamp: string;
  chunkIndex: number;
  contentHash: string;
}

const DEFAULT_CHUNK_SIZE = 1600;
const DEFAULT_OVERLAP = 200;
const MAX_ATTACHMENT_TEXT = 900;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isSanitizedAttachmentPlaceholder(value: string): boolean {
  return /^\[\d+\s+chars?\]$/i.test(value.trim());
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function getConversationContentHash(conversation: Conversation): string {
  const source = JSON.stringify({
    id: conversation.id,
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      streamStatus: message.streamStatus,
      attachments: message.attachments?.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        extractedText: attachment.extractedText,
      })),
    })),
  });

  return hashText(source);
}

export function messageToRetrievalText(message: Message): string {
  const parts: string[] = [];
  const content = normalizeWhitespace(message.content);

  if (content) {
    parts.push(content);
  }

  for (const attachment of message.attachments ?? []) {
    const extracted = attachment.extractedText?.trim();
    if (!extracted || isSanitizedAttachmentPlaceholder(extracted)) continue;

    parts.push(
      `[Arquivo ${attachment.name}: ${normalizeWhitespace(extracted).slice(
        0,
        MAX_ATTACHMENT_TEXT
      )}]`
    );
  }

  return parts.join("\n");
}

function buildMessageLines(messages: Message[]) {
  return messages
    .filter((message) => {
      if (message.role === "assistant" && message.streamStatus !== "completed") {
        return false;
      }
      return messageToRetrievalText(message).length > 0;
    })
    .map((message) => {
      const label = message.role === "user" ? "USER" : "ASSISTANT";
      return {
        id: message.id,
        role: message.role,
        timestamp: message.timestamp.toISOString(),
        text: `[${label}] ${messageToRetrievalText(message)}`,
      };
    });
}

export function chunkConversation(
  conversation: Conversation,
  options: { chunkSize?: number; overlap?: number } = {}
): ConversationChunk[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? DEFAULT_OVERLAP, chunkSize - 1);
  const lines = buildMessageLines(conversation.messages);
  const chunks: ConversationChunk[] = [];

  let currentText = "";
  let currentIds: string[] = [];
  let currentRoles: string[] = [];
  let currentTimestamp =
    conversation.updatedAt?.toISOString?.() ?? new Date().toISOString();

  const flush = () => {
    const text = currentText.trim();
    if (!text) return;

    const chunkIndex = chunks.length;
    chunks.push({
      id: `${conversation.id}:${chunkIndex}:${hashText(text).slice(0, 12)}`,
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      messageIds: currentIds,
      chunkText: text,
      embeddingText: `${conversation.title}\n${text}`,
      roleSpan: Array.from(new Set(currentRoles)).join(","),
      timestamp: currentTimestamp,
      chunkIndex,
      contentHash: hashText(text),
    });
  };

  for (const line of lines) {
    const nextText = currentText ? `${currentText}\n\n${line.text}` : line.text;

    if (currentText && nextText.length > chunkSize) {
      flush();
      const tail =
        overlap > 0 && currentText.length > overlap
          ? currentText.slice(-overlap)
          : "";
      currentText = tail ? `${tail}\n\n${line.text}` : line.text;
      currentIds = line.id ? [line.id] : [];
      currentRoles = [line.role];
      currentTimestamp = line.timestamp;
      continue;
    }

    currentText = nextText;
    currentIds.push(line.id);
    currentRoles.push(line.role);
    currentTimestamp = line.timestamp;
  }

  flush();
  return chunks;
}
