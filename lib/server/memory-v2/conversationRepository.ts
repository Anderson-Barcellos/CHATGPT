import type {
  Conversation,
  FileAttachment,
  Message,
  SerializedConversationWorkspace,
} from "@/types";
import type { MemoryDatabase } from "./database";
import { withMemoryTransaction } from "./database";

export interface ConversationListOptions {
  lifecycle?: "active" | "archived";
}

export interface DeletionReport {
  conversations: number;
  messages: number;
  attachments: number;
  evidence: number;
  facts: number;
}

interface ConversationRow {
  id: string;
  title: string;
  lifecycle: "active" | "archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  workspace_json: string;
}

interface MessageRow {
  id: string;
  role: Message["role"];
  content: string;
  stream_status: Message["streamStatus"] | null;
  response_mode: Message["responseMode"] | null;
  timestamp: string;
  metadata_json: string;
}

interface AttachmentRow {
  id: string;
  name: string;
  media_type: string;
  url: string | null;
  extracted_text: string | null;
  metadata_json: string;
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function loadAttachments(
  database: MemoryDatabase,
  messageId: string
): FileAttachment[] | undefined {
  const rows = database.raw
    .prepare(
      "SELECT id, name, media_type, url, extracted_text, metadata_json FROM conversation_attachments WHERE message_id = ? ORDER BY rowid"
    )
    .all(messageId) as AttachmentRow[];
  if (rows.length === 0) return undefined;

  return rows.map((row) => {
    const { legacyHash: _legacyHash, ...metadata } = parseObject(
      row.metadata_json
    );
    return {
      ...(metadata as Partial<FileAttachment>),
      id: row.id,
      name: row.name,
      mimeType: row.media_type,
      ...(row.url !== null && { dataUrl: row.url }),
      ...(row.extracted_text !== null && { extractedText: row.extracted_text }),
    } as FileAttachment;
  });
}

function fromRow(database: MemoryDatabase, row: ConversationRow): Conversation {
  const messageRows = database.raw
    .prepare(
      "SELECT id, role, content, stream_status, response_mode, timestamp, metadata_json FROM conversation_messages WHERE conversation_id = ? ORDER BY ordinal"
    )
    .all(row.id) as MessageRow[];
  const workspace = parseObject(
    row.workspace_json
  ) as unknown as SerializedConversationWorkspace;

  return {
    id: row.id,
    title: row.title,
    lifecycle: row.lifecycle,
    messages: messageRows.map((messageRow) => {
      const { legacyHash: _legacyHash, ...metadata } = parseObject(
        messageRow.metadata_json
      );
      const attachments = loadAttachments(database, messageRow.id);
      return {
        ...(metadata as Partial<Message>),
        id: messageRow.id,
        role: messageRow.role,
        content: messageRow.content,
        timestamp: new Date(messageRow.timestamp),
        ...(messageRow.stream_status !== null && {
          streamStatus: messageRow.stream_status,
        }),
        ...(messageRow.response_mode !== null && {
          responseMode: messageRow.response_mode,
        }),
        ...(attachments && { attachments }),
      } as Message;
    }),
    workspace:
      workspace.notes && typeof workspace.notes === "object"
        ? {
            notes: {
              ...workspace.notes,
              updatedAt: new Date(workspace.notes.updatedAt),
            },
          }
        : undefined,
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function insertMessages(database: MemoryDatabase, conversation: Conversation): void {
  const insertMessage = database.raw.prepare(
    "INSERT INTO conversation_messages (id, conversation_id, role, content, stream_status, response_mode, timestamp, ordinal, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertAttachment = database.raw.prepare(
    "INSERT INTO conversation_attachments (id, message_id, name, media_type, url, extracted_text, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  conversation.messages.forEach((message, ordinal) => {
    const {
      id,
      role,
      content,
      timestamp,
      streamStatus,
      responseMode,
      attachments,
      ...metadata
    } = message;
    insertMessage.run(
      id,
      conversation.id,
      role,
      content,
      streamStatus ?? null,
      responseMode ?? null,
      timestamp.toISOString(),
      ordinal,
      JSON.stringify(metadata)
    );

    for (const attachment of attachments ?? []) {
      const {
        id: attachmentId,
        name,
        mimeType,
        dataUrl,
        extractedText,
        ...attachmentMetadata
      } = attachment;
      insertAttachment.run(
        attachmentId,
        id,
        name,
        mimeType,
        dataUrl ?? null,
        extractedText ?? null,
        JSON.stringify(attachmentMetadata)
      );
    }
  });
}

function serializeWorkspace(conversation: Conversation): string {
  if (!conversation.workspace) return "{}";
  return JSON.stringify({
    notes: {
      ...conversation.workspace.notes,
      updatedAt: conversation.workspace.notes.updatedAt.toISOString(),
    },
  });
}

export function createConversation(
  database: MemoryDatabase,
  conversation: Conversation
): Conversation {
  return withMemoryTransaction(database, () => {
    database.raw
      .prepare(
        "INSERT INTO conversations (id, title, lifecycle, created_at, updated_at, archived_at, workspace_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        conversation.id,
        conversation.title,
        conversation.lifecycle ?? "active",
        conversation.createdAt.toISOString(),
        conversation.updatedAt.toISOString(),
        conversation.archivedAt?.toISOString() ?? null,
        serializeWorkspace(conversation)
      );
    insertMessages(database, conversation);
    return getConversation(database, conversation.id)!;
  });
}

export function getConversation(
  database: MemoryDatabase,
  id: string
): Conversation | undefined {
  const row = database.raw
    .prepare(
      "SELECT id, title, lifecycle, created_at, updated_at, archived_at, workspace_json FROM conversations WHERE id = ?"
    )
    .get(id) as ConversationRow | undefined;
  return row ? fromRow(database, row) : undefined;
}

export function listConversations(
  database: MemoryDatabase,
  options: ConversationListOptions = {}
): Conversation[] {
  const lifecycle = options.lifecycle ?? "active";
  const rows = database.raw
    .prepare(
      "SELECT id, title, lifecycle, created_at, updated_at, archived_at, workspace_json FROM conversations WHERE lifecycle = ? ORDER BY updated_at DESC, id"
    )
    .all(lifecycle) as ConversationRow[];
  return rows.map((row) => fromRow(database, row));
}

export function updateConversation(
  database: MemoryDatabase,
  id: string,
  updates: Partial<Conversation>
): Conversation | undefined {
  return withMemoryTransaction(database, () => {
    const existing = getConversation(database, id);
    if (!existing) return undefined;
    const updated: Conversation = { ...existing, ...updates, id };
    database.raw
      .prepare(
        "UPDATE conversations SET title = ?, lifecycle = ?, created_at = ?, updated_at = ?, archived_at = ?, workspace_json = ? WHERE id = ?"
      )
      .run(
        updated.title,
        updated.lifecycle ?? "active",
        updated.createdAt.toISOString(),
        updated.updatedAt.toISOString(),
        updated.archivedAt?.toISOString() ?? null,
        serializeWorkspace(updated),
        id
      );
    if (updates.messages) {
      database.raw
        .prepare("DELETE FROM conversation_messages WHERE conversation_id = ?")
        .run(id);
      insertMessages(database, updated);
    }
    return getConversation(database, id);
  });
}

export function archiveConversation(
  database: MemoryDatabase,
  id: string
): Conversation | undefined {
  const archivedAt = new Date().toISOString();
  database.raw
    .prepare(
      "UPDATE conversations SET lifecycle = 'archived', archived_at = ? WHERE id = ?"
    )
    .run(archivedAt, id);
  return getConversation(database, id);
}

export function restoreConversation(
  database: MemoryDatabase,
  id: string
): Conversation | undefined {
  database.raw
    .prepare(
      "UPDATE conversations SET lifecycle = 'active', archived_at = NULL WHERE id = ?"
    )
    .run(id);
  return getConversation(database, id);
}

export function permanentlyDeleteConversation(
  database: MemoryDatabase,
  id: string
): DeletionReport {
  return withMemoryTransaction(database, () => {
    const conversations = database.raw
      .prepare("SELECT COUNT(*) AS count FROM conversations WHERE id = ?")
      .get(id) as { count: number };
    const messages = database.raw
      .prepare(
        "SELECT COUNT(*) AS count FROM conversation_messages WHERE conversation_id = ?"
      )
      .get(id) as { count: number };
    const attachments = database.raw
      .prepare(
        "SELECT COUNT(*) AS count FROM conversation_attachments WHERE message_id IN (SELECT id FROM conversation_messages WHERE conversation_id = ?)"
      )
      .get(id) as { count: number };
    const evidence = database.raw
      .prepare("SELECT COUNT(*) AS count FROM memory_evidence WHERE conversation_id = ?")
      .get(id) as { count: number };
    const exclusiveFacts = database.raw
      .prepare(
        `SELECT f.id
         FROM memory_facts f
         WHERE EXISTS (
           SELECT 1
           FROM memory_fact_versions target_version
           JOIN memory_evidence target ON target.version_id = target_version.id
           WHERE target_version.fact_id = f.id AND target.conversation_id = ?
         )
         AND NOT EXISTS (
           SELECT 1
           FROM memory_fact_versions other_version
           JOIN memory_evidence other ON other.version_id = other_version.id
           WHERE other_version.fact_id = f.id
             AND (other.conversation_id IS NULL OR other.conversation_id <> ?)
         )`
      )
      .all(id, id) as { id: string }[];

    database.raw
      .prepare("DELETE FROM memory_evidence WHERE conversation_id = ?")
      .run(id);
    const deleteFact = database.raw.prepare("DELETE FROM memory_facts WHERE id = ?");
    for (const fact of exclusiveFacts) deleteFact.run(fact.id);
    database.raw.prepare("DELETE FROM conversations WHERE id = ?").run(id);

    return {
      conversations: conversations.count,
      messages: messages.count,
      attachments: attachments.count,
      evidence: evidence.count,
      facts: exclusiveFacts.length,
    };
  });
}
