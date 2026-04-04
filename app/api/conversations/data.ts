import { Conversation } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { deserializeConversation, serializeConversation } from "@/lib/storage/serializers";

const FILE_NAME = "conversations.json";

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

export async function listConversations(): Promise<Conversation[]> {
  return readAll();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const conversations = await readAll();
  return conversations.find((c) => c.id === id);
}

export function createConversation(title?: string): Promise<Conversation> {
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: title || "Nova conversa",
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

export function deleteConversation(id: string): Promise<boolean> {
  return withDataFileLock(FILE_NAME, async () => {
    const conversations = await readAll();
    const filtered = conversations.filter((c) => c.id !== id);
    if (filtered.length === conversations.length) return false;
    await writeAll(filtered);
    return true;
  });
}
