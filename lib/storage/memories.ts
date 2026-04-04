import { apiUrl } from "@/lib/utils";
import { Memory, MemoryCategory, SerializedMemory } from "@/types";
import { deserializeMemory } from "@/lib/storage/serializers";

export async function listMemories(): Promise<Memory[]> {
  const response = await fetch(apiUrl("/api/memories"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as SerializedMemory[];
  return Array.isArray(data) ? data.map(deserializeMemory) : [];
}

export async function addMemory(input: {
  content: string;
  category: MemoryCategory;
  isActive: boolean;
  priority: number;
}): Promise<Memory> {
  const response = await fetch(apiUrl("/api/memories"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return deserializeMemory((await response.json()) as SerializedMemory);
}

export async function updateMemory(
  id: string,
  updates: Partial<Memory>
): Promise<Memory> {
  const response = await fetch(apiUrl(`/api/memories/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return deserializeMemory((await response.json()) as SerializedMemory);
}

export async function deleteMemory(id: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/memories/${id}`), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}
