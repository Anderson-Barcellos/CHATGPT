import { Memory } from "@/types";
import { readDataFile, withDataFileLock, writeDataFile } from "@/lib/server/jsonFileStore";
import { deserializeMemory, serializeMemory } from "@/lib/storage/serializers";

const FILE_NAME = "memories.json";

async function readAll(): Promise<Memory[]> {
  const parsed = await readDataFile(FILE_NAME, [] as unknown[]);
  if (!Array.isArray(parsed)) return [];

  return parsed.map((memory) => deserializeMemory(memory as Memory));
}

async function writeAll(memories: Memory[]) {
  await writeDataFile(
    FILE_NAME,
    memories.map((memory) => serializeMemory(memory))
  );
}

export async function listMemories(): Promise<Memory[]> {
  return readAll();
}

export function createMemory(
  input: Omit<Memory, "id" | "createdAt" | "updatedAt">
): Promise<Memory> {
  return withDataFileLock(FILE_NAME, async () => {
    const memories = await readAll();
    const now = new Date();
    const memory: Memory = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    memories.unshift(memory);
    await writeAll(memories);
    return memory;
  });
}

export function updateMemory(
  id: string,
  updates: Partial<Memory>
): Promise<Memory | undefined> {
  return withDataFileLock(FILE_NAME, async () => {
    const memories = await readAll();
    const index = memories.findIndex((memory) => memory.id === id);
    if (index === -1) return undefined;

    const updated: Memory = {
      ...memories[index],
      ...updates,
      updatedAt: new Date(),
    };

    memories[index] = updated;
    await writeAll(memories);
    return updated;
  });
}

export function deleteMemory(id: string): Promise<boolean> {
  return withDataFileLock(FILE_NAME, async () => {
    const memories = await readAll();
    const filtered = memories.filter((memory) => memory.id !== id);

    if (filtered.length === memories.length) return false;

    await writeAll(filtered);
    return true;
  });
}
