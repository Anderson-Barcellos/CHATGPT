import { promises as fs } from "fs";
import path from "path";
import { Conversation } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "conversations.json");

let lockChain = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = lockChain.then(fn, fn);
  lockChain = next.then(() => {}, () => {});
  return next;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify([]), "utf-8");
  }
}

async function readAll(): Promise<Conversation[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

async function writeAll(conversations: Conversation[]) {
  await ensureFile();
  const serializable = conversations.map((c) => ({
    ...c,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }));
  await fs.writeFile(FILE_PATH, JSON.stringify(serializable, null, 2), "utf-8");
}

export async function listConversations(): Promise<Conversation[]> {
  return readAll();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const conversations = await readAll();
  return conversations.find((c) => c.id === id);
}

export function createConversation(title?: string): Promise<Conversation> {
  return withLock(async () => {
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
  return withLock(async () => {
    const conversations = await readAll();
    const idx = conversations.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const now = new Date().toISOString();
    const updated = {
      ...conversations[idx],
      ...updates,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt as any) : new Date(now),
    } as Conversation;
    conversations[idx] = updated;
    await writeAll(conversations);
    return updated;
  });
}

export function deleteConversation(id: string): Promise<boolean> {
  return withLock(async () => {
    const conversations = await readAll();
    const filtered = conversations.filter((c) => c.id !== id);
    if (filtered.length === conversations.length) return false;
    await writeAll(filtered);
    return true;
  });
}
