import { createHash } from "node:crypto";
import type { MemoryDatabase } from "./database";
import { withMemoryTransaction } from "./database";

export interface LegacySnapshot {
  conversations: unknown[];
  memories: unknown[];
  suggestions: unknown[];
}

export interface LegacyImportReport {
  conversations: number;
  messages: number;
  attachments: number;
  memories: number;
  suggestions: number;
  skipped: number;
  hashes: Record<"conversations" | "memories" | "suggestions", string>;
}

export interface LegacyReconciliationMismatch {
  entity: "conversation" | "message" | "attachment" | "memory" | "suggestion";
  id: string;
  field: string;
}

export interface LegacyReconciliationReport {
  mismatches: LegacyReconciliationMismatch[];
}

type JsonObject = Record<string, unknown>;

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Pessoal",
  professional: "Profissional",
  preferences: "Preferências",
  projects: "Projetos",
  technical: "Técnico",
  other: "Outros",
};

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid legacy ${label}`);
  }
  return value as JsonObject;
}

function stringField(value: JsonObject, field: string, label: string): string {
  if (typeof value[field] !== "string") {
    throw new Error(`Invalid legacy ${label}.${field}`);
  }
  return value[field] as string;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)])
  );
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function metadataHash(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const parsed = JSON.parse(value) as { legacyHash?: unknown };
    return typeof parsed.legacyHash === "string" ? parsed.legacyHash : "";
  } catch {
    return "";
  }
}

function collision(entity: string, id: string): never {
  throw new Error(`Legacy ID collision: ${entity} ${id}`);
}

function sourceHashes(snapshot: LegacySnapshot) {
  return {
    conversations: hashValue(snapshot.conversations),
    memories: hashValue(snapshot.memories),
    suggestions: hashValue(snapshot.suggestions),
  };
}

export function importLegacySnapshot(
  snapshot: LegacySnapshot,
  database: MemoryDatabase
): LegacyImportReport {
  const report: LegacyImportReport = {
    conversations: 0,
    messages: 0,
    attachments: 0,
    memories: 0,
    suggestions: 0,
    skipped: 0,
    hashes: sourceHashes(snapshot),
  };

  return withMemoryTransaction(database, () => {
    for (const rawConversation of snapshot.conversations) {
      const conversation = asObject(rawConversation, "conversation");
      const id = stringField(conversation, "id", "conversation");
      const title = stringField(conversation, "title", "conversation");
      const createdAt = stringField(conversation, "createdAt", "conversation");
      const updatedAt = stringField(conversation, "updatedAt", "conversation");
      const incomingHash = hashValue(conversation);
      const existing = database.raw
        .prepare("SELECT content_hash FROM conversations WHERE id = ?")
        .get(id) as { content_hash: string | null } | undefined;
      if (existing) {
        if (existing.content_hash !== incomingHash) collision("conversation", id);
        report.skipped += 1;
      } else {
        database.raw
          .prepare(
            "INSERT INTO conversations (id, title, lifecycle, created_at, updated_at, content_hash, workspace_json) VALUES (?, ?, 'active', ?, ?, ?, ?)"
          )
          .run(
            id,
            title,
            createdAt,
            updatedAt,
            incomingHash,
            JSON.stringify(
              conversation.workspace && typeof conversation.workspace === "object"
                ? conversation.workspace
                : {}
            )
          );
        report.conversations += 1;
      }

      const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      messages.forEach((rawMessage, ordinal) => {
        const message = asObject(rawMessage, "message");
        const messageId = stringField(message, "id", "message");
        const role = stringField(message, "role", "message");
        const content = stringField(message, "content", "message");
        const timestamp = stringField(message, "timestamp", "message");
        const messageHash = hashValue(message);
        const existingMessage = database.raw
          .prepare("SELECT metadata_json FROM conversation_messages WHERE id = ?")
          .get(messageId) as { metadata_json: string } | undefined;
        if (existingMessage) {
          if (metadataHash(existingMessage.metadata_json) !== messageHash) {
            collision("message", messageId);
          }
          report.skipped += 1;
        } else {
          const {
            id: _messageId,
            role: _role,
            content: _content,
            timestamp: _timestamp,
            streamStatus: _streamStatus,
            responseMode: _responseMode,
            attachments: _attachments,
            ...messageMetadata
          } = message;
          database.raw
            .prepare(
              "INSERT INTO conversation_messages (id, conversation_id, role, content, stream_status, response_mode, timestamp, ordinal, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .run(
              messageId,
              id,
              role,
              content,
              typeof message.streamStatus === "string" ? message.streamStatus : null,
              typeof message.responseMode === "string" ? message.responseMode : null,
              timestamp,
              ordinal,
              JSON.stringify({ ...messageMetadata, legacyHash: messageHash })
            );
          report.messages += 1;
        }

        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        for (const rawAttachment of attachments) {
          const attachment = asObject(rawAttachment, "attachment");
          const attachmentId = stringField(attachment, "id", "attachment");
          const attachmentHash = hashValue(attachment);
          const existingAttachment = database.raw
            .prepare("SELECT metadata_json FROM conversation_attachments WHERE id = ?")
            .get(attachmentId) as { metadata_json: string } | undefined;
          if (existingAttachment) {
            if (metadataHash(existingAttachment.metadata_json) !== attachmentHash) {
              collision("attachment", attachmentId);
            }
            report.skipped += 1;
          } else {
            database.raw
              .prepare(
                "INSERT INTO conversation_attachments (id, message_id, name, media_type, url, extracted_text, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
              )
              .run(
                attachmentId,
                messageId,
                stringField(attachment, "name", "attachment"),
                stringField(attachment, "mimeType", "attachment"),
                typeof attachment.dataUrl === "string" ? attachment.dataUrl : null,
                typeof attachment.extractedText === "string"
                  ? attachment.extractedText
                  : null,
                JSON.stringify({
                  legacyHash: attachmentHash,
                  type: attachment.type,
                  size: attachment.size,
                  thumbnailUrl: attachment.thumbnailUrl,
                })
              );
            report.attachments += 1;
          }
        }
      });
    }

    for (const rawMemory of snapshot.memories) {
      const memory = asObject(rawMemory, "memory");
      const id = stringField(memory, "id", "memory");
      const content = stringField(memory, "content", "memory");
      const createdAt = stringField(memory, "createdAt", "memory");
      const updatedAt = stringField(memory, "updatedAt", "memory");
      const category =
        typeof memory.category === "string" && CATEGORY_LABELS[memory.category]
          ? memory.category
          : "other";
      const priority =
        typeof memory.priority === "number" ? Math.round(memory.priority) : 0;
      const active = memory.isActive === true;
      const state = active ? "current" : "archived";
      const topicId = `legacy-topic-${category}`;
      database.raw
        .prepare(
          "INSERT INTO memory_topics (id, slug, title, state, aliases_json, created_at, updated_at) VALUES (?, ?, ?, 'active', '[]', ?, ?) ON CONFLICT(id) DO NOTHING"
        )
        .run(topicId, category, CATEGORY_LABELS[category], createdAt, updatedAt);

      const existingFact = database.raw
        .prepare(
          "SELECT f.state, f.legacy_priority, v.content FROM memory_facts f JOIN memory_fact_versions v ON v.fact_id = f.id AND v.state = 'current' WHERE f.id = ?"
        )
        .get(id) as
        | { state: string; legacy_priority: number | null; content: string }
        | undefined;
      if (existingFact) {
        if (
          existingFact.state !== state ||
          existingFact.legacy_priority !== priority ||
          existingFact.content !== content
        ) {
          collision("memory", id);
        }
        report.skipped += 1;
        continue;
      }

      const confidence = Math.min(Math.max(priority / 20, 0), 1);
      database.raw
        .prepare(
          "INSERT INTO memory_facts (id, topic_id, fact_type, sensitivity, confidence, legacy_priority, state, is_core, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          id,
          topicId,
          category,
          category === "personal" ? "personal" : "standard",
          confidence,
          priority,
          state,
          active ? 1 : 0,
          createdAt,
          updatedAt
        );
      database.raw
        .prepare(
          "INSERT INTO memory_fact_versions (id, fact_id, content, normalized_content, state, confidence, reason, author, created_at) VALUES (?, ?, ?, ?, 'current', ?, 'legacy_import', 'legacy_import', ?)"
        )
        .run(`${id}:legacy-v1`, id, content, normalizeText(content), confidence, createdAt);
      report.memories += 1;
    }

    for (const rawSuggestion of snapshot.suggestions) {
      const suggestion = asObject(rawSuggestion, "suggestion");
      const id = stringField(suggestion, "id", "suggestion");
      const suggestionHash = hashValue(suggestion);
      const existing = database.raw
        .prepare("SELECT payload_json FROM memory_operations WHERE id = ?")
        .get(id) as { payload_json: string } | undefined;
      if (existing) {
        if (metadataHash(existing.payload_json) !== suggestionHash) {
          collision("suggestion", id);
        }
        report.skipped += 1;
        continue;
      }

      const sourceConversationId =
        typeof suggestion.sourceConversationId === "string" &&
        database.raw
          .prepare("SELECT 1 FROM conversations WHERE id = ?")
          .get(suggestion.sourceConversationId)
          ? suggestion.sourceConversationId
          : null;
      const legacyStatus = stringField(suggestion, "status", "suggestion");
      const operationStatus =
        legacyStatus === "accepted"
          ? "applied"
          : legacyStatus === "rejected"
            ? "rejected"
            : "review";
      database.raw
        .prepare(
          "INSERT INTO memory_operations (id, operation_type, status, payload_json, source_conversation_id, confidence, created_at, applied_at) VALUES (?, 'legacy_suggestion', ?, ?, ?, ?, ?, ?)"
        )
        .run(
          id,
          operationStatus,
          JSON.stringify({ ...suggestion, legacyHash: suggestionHash }),
          sourceConversationId,
          typeof suggestion.confidence === "number" ? suggestion.confidence : null,
          stringField(suggestion, "createdAt", "suggestion"),
          operationStatus === "applied"
            ? stringField(suggestion, "updatedAt", "suggestion")
            : null
        );
      report.suggestions += 1;
    }

    return report;
  });
}

export function reconcileLegacySnapshot(
  snapshot: LegacySnapshot,
  database: MemoryDatabase
): LegacyReconciliationReport {
  const mismatches: LegacyReconciliationMismatch[] = [];

  for (const rawConversation of snapshot.conversations) {
    const conversation = asObject(rawConversation, "conversation");
    const id = stringField(conversation, "id", "conversation");
    const stored = database.raw
      .prepare("SELECT title, created_at, updated_at FROM conversations WHERE id = ?")
      .get(id) as
      | { title: string; created_at: string; updated_at: string }
      | undefined;
    if (!stored) {
      mismatches.push({ entity: "conversation", id, field: "missing" });
      continue;
    }
    if (stored.title !== conversation.title) {
      mismatches.push({ entity: "conversation", id, field: "title" });
    }
    if (stored.created_at !== conversation.createdAt) {
      mismatches.push({ entity: "conversation", id, field: "createdAt" });
    }
    if (stored.updated_at !== conversation.updatedAt) {
      mismatches.push({ entity: "conversation", id, field: "updatedAt" });
    }

    const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
    for (const rawMessage of messages) {
      const message = asObject(rawMessage, "message");
      const messageId = stringField(message, "id", "message");
      const storedMessage = database.raw
        .prepare("SELECT metadata_json FROM conversation_messages WHERE id = ?")
        .get(messageId) as { metadata_json: string } | undefined;
      if (!storedMessage || metadataHash(storedMessage.metadata_json) !== hashValue(message)) {
        mismatches.push({ entity: "message", id: messageId, field: "contentHash" });
      }
      for (const rawAttachment of Array.isArray(message.attachments)
        ? message.attachments
        : []) {
        const attachment = asObject(rawAttachment, "attachment");
        const attachmentId = stringField(attachment, "id", "attachment");
        const storedAttachment = database.raw
          .prepare("SELECT metadata_json FROM conversation_attachments WHERE id = ?")
          .get(attachmentId) as { metadata_json: string } | undefined;
        if (
          !storedAttachment ||
          metadataHash(storedAttachment.metadata_json) !== hashValue(attachment)
        ) {
          mismatches.push({
            entity: "attachment",
            id: attachmentId,
            field: "contentHash",
          });
        }
      }
    }
  }

  for (const rawMemory of snapshot.memories) {
    const memory = asObject(rawMemory, "memory");
    const id = stringField(memory, "id", "memory");
    const stored = database.raw
      .prepare(
        "SELECT f.state, f.legacy_priority, v.content FROM memory_facts f JOIN memory_fact_versions v ON v.fact_id = f.id AND v.state = 'current' WHERE f.id = ?"
      )
      .get(id) as
      | { state: string; legacy_priority: number | null; content: string }
      | undefined;
    if (!stored) {
      mismatches.push({ entity: "memory", id, field: "missing" });
      continue;
    }
    if (stored.content !== memory.content) {
      mismatches.push({ entity: "memory", id, field: "content" });
    }
    if (stored.legacy_priority !== memory.priority) {
      mismatches.push({ entity: "memory", id, field: "priority" });
    }
    const expectedState = memory.isActive === true ? "current" : "archived";
    if (stored.state !== expectedState) {
      mismatches.push({ entity: "memory", id, field: "state" });
    }
  }

  for (const rawSuggestion of snapshot.suggestions) {
    const suggestion = asObject(rawSuggestion, "suggestion");
    const id = stringField(suggestion, "id", "suggestion");
    const stored = database.raw
      .prepare("SELECT payload_json FROM memory_operations WHERE id = ?")
      .get(id) as { payload_json: string } | undefined;
    if (!stored || metadataHash(stored.payload_json) !== hashValue(suggestion)) {
      mismatches.push({ entity: "suggestion", id, field: "contentHash" });
    }
  }

  return { mismatches };
}
