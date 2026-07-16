import type { MessageStreamStatus } from "@/types";
import {
  createMemorySuggestions,
  indexConversationMemory,
} from "@/lib/storage/memoryRag";

interface MemoryRefreshDependencies {
  indexConversationMemory: typeof indexConversationMemory;
  createMemorySuggestions: typeof createMemorySuggestions;
}

const defaultDependencies: MemoryRefreshDependencies = {
  indexConversationMemory,
  createMemorySuggestions,
};

export async function refreshConversationMemoryLayer(
  conversationId: string,
  status: MessageStreamStatus,
  dependencies: MemoryRefreshDependencies = defaultDependencies
): Promise<void> {
  if (status === "streaming") return;

  await dependencies.indexConversationMemory(conversationId);
  if (status === "completed") {
    await dependencies.createMemorySuggestions(conversationId);
  }
}
