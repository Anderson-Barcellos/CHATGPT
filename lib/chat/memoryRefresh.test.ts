import { describe, expect, it, vi } from "vitest";
import { refreshConversationMemoryLayer } from "@/lib/chat/memoryRefresh";

function createDependencies() {
  return {
    indexConversationMemory: vi.fn().mockResolvedValue({
      results: [],
      stats: { chunks: 0 },
    }),
    createMemorySuggestions: vi.fn().mockResolvedValue([]),
  };
}

describe("conversation memory refresh", () => {
  it("indexes and generates suggestions after a completed response", async () => {
    const dependencies = createDependencies();

    await refreshConversationMemoryLayer("conv-1", "completed", dependencies);

    expect(dependencies.indexConversationMemory).toHaveBeenCalledWith("conv-1");
    expect(dependencies.createMemorySuggestions).toHaveBeenCalledWith("conv-1");
  });

  it.each(["aborted", "interrupted", "failed"] as const)(
    "indexes but does not generate suggestions after %s",
    async (status) => {
      const dependencies = createDependencies();

      await refreshConversationMemoryLayer("conv-1", status, dependencies);

      expect(dependencies.indexConversationMemory).toHaveBeenCalledWith("conv-1");
      expect(dependencies.createMemorySuggestions).not.toHaveBeenCalled();
    }
  );

  it("does nothing while a response is still streaming", async () => {
    const dependencies = createDependencies();

    await refreshConversationMemoryLayer("conv-1", "streaming", dependencies);

    expect(dependencies.indexConversationMemory).not.toHaveBeenCalled();
    expect(dependencies.createMemorySuggestions).not.toHaveBeenCalled();
  });
});
