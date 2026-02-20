import { db } from "@/lib/storage/db";
import { Memory, MemoryCategory } from "@/types";

export async function listMemories(): Promise<Memory[]> {
  return db.memories.toArray();
}

export async function addMemory(input: {
  content: string;
  category: MemoryCategory;
  isActive: boolean;
  priority: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();

  const memory: Memory = {
    id,
    content: input.content,
    category: input.category,
    isActive: input.isActive,
    priority: input.priority,
    createdAt: now,
    updatedAt: now,
  };

  await db.memories.put(memory);
  return id;
}

export async function updateMemory(
  id: string,
  updates: Partial<Memory>
): Promise<void> {
  await db.memories.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await db.memories.delete(id);
}
