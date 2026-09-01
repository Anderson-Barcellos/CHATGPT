import { Conversation } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { deserializeConversation, serializeConversation } from "@/lib/storage/serializers";
import { openMemoryDatabase, type MemoryDatabase } from "@/lib/server/memory-v2/database";
import {
  archiveConversation as archiveV2Conversation,
  createConversation as createV2Conversation,
  getConversation as getV2Conversation,
  listConversations as listV2Conversations,
  permanentlyDeleteConversation as permanentlyDeleteV2Conversation,
  restoreConversation as restoreV2Conversation,
  updateConversation as updateV2Conversation,
  type ConversationListOptions,
  type DeletionReport,
} from "@/lib/server/memory-v2/conversationRepository";

const FILE_NAME = "conversations.json";
let memoryV2Database: MemoryDatabase | undefined;

function v2Enabled(): boolean {
  return process.env.MEMORY_V2_ENABLED === "true";
}

function v2Database(): MemoryDatabase {
  memoryV2Database ??= openMemoryDatabase({
    path: process.env.MEMORY_V2_DATABASE_PATH,
  });
  return memoryV2Database;
}

async function readAll(): Promise<Conversation[]> {
  const parsed = await readDataFile(FILE_NAME, [] as unknown[]);
  if (!Array.isArray(parsed)) return [];

  return parsed.map((conversation) =>
    deserializeConversation(conversation as Conversation)
  );
}

async function writeAll(conversations: Conversation[]) {
  await writeDataFile(
    FILE_NAME,
    conversations.map((conversation) => serializeConversation(conversation))
  );
}

export async function listConversations(
  options: ConversationListOptions = {}
): Promise<Conversation[]> {
  if (v2Enabled()) return listV2Conversations(v2Database(), options);
  const lifecycle = options.lifecycle ?? "active";
  return (await readAll()).filter(
    (conversation) => (conversation.lifecycle ?? "active") === lifecycle
  );
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  if (v2Enabled()) return getV2Conversation(v2Database(), id);
  const conversations = await readAll();
  return conversations.find((c) => c.id === id);
}

export function createConversation(title?: string): Promise<Conversation> {
  if (v2Enabled()) {
    const now = new Date();
    return Promise.resolve(
      createV2Conversation(v2Database(), {
        id: crypto.randomUUID(),
        title: title || "Nova conversa",
        lifecycle: "active",
        messages: [],
        createdAt: now,
        updatedAt: now,
      })
    );
  }
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: title || "Nova conversa",
      lifecycle: "active",
      messages: [],
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    conversations.unshift(conv);
    await writeAll(conversations);
    return conv;
  });
}

export function updateConversation(
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation | undefined> {
  if (v2Enabled()) {
    const normalizedUpdates = {
      ...updates,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(),
    };
    return Promise.resolve(
      updateV2Conversation(v2Database(), id, normalizedUpdates)
    );
  }
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const idx = conversations.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const now = new Date().toISOString();
    const updated = {
      ...conversations[idx],
      ...updates,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(now),
    } as Conversation;
    conversations[idx] = updated;
    await writeAll(conversations);
    return updated;
  });
}

export function archiveConversation(
  id: string
): Promise<Conversation | undefined> {
  if (v2Enabled()) {
    return Promise.resolve(archiveV2Conversation(v2Database(), id));
  }
  return updateConversation(id, {
    lifecycle: "archived",
    archivedAt: new Date(),
  });
}

export function restoreConversation(
  id: string
): Promise<Conversation | undefined> {
  if (v2Enabled()) {
    return Promise.resolve(restoreV2Conversation(v2Database(), id));
  }
  return updateConversation(id, {
    lifecycle: "active",
    archivedAt: undefined,
  });
}

export async function permanentlyDeleteConversation(
  id: string
): Promise<DeletionReport> {
  if (v2Enabled()) {
    return permanentlyDeleteV2Conversation(v2Database(), id);
  }
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) {
      return {
        conversations: 0,
        messages: 0,
        attachments: 0,
        evidence: 0,
        facts: 0,
      };
    }
    const { deleteConversationFromMemoryIndex } = await import(
      "@/lib/server/memory/indexStore"
    );
    await deleteConversationFromMemoryIndex(id);
    await writeAll(conversations.filter((item) => item.id !== id));
    return {
      conversations: 1,
      messages: conversation.messages.length,
      attachments: conversation.messages.reduce(
        (total, message) => total + (message.attachments?.length ?? 0),
        0
      ),
      evidence: 0,
      facts: 0,
    };
  });
}

/** @deprecated Use archiveConversation or permanentlyDeleteConversation. */
export async function deleteConversation(id: string): Promise<boolean> {
  if (v2Enabled()) {
    const report = await permanentlyDeleteV2Conversation(v2Database(), id);
    return report.conversations === 1;
  }
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const filtered = conversations.filter((c) => c.id !== id);
    if (filtered.length === conversations.length) return false;
    await writeAll(filtered);
    return true;
  });
}
