import { describe, expect, it, vi } from "vitest";
import { ClientApiError } from "@/lib/api/errors";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";

describe("withConversationPersistenceRetry", () => {
  it("retries once for retryable conversation persistence errors", async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new ClientApiError(500, {
          error: "Failed to update conversation",
          code: "conversation_update_failed",
        })
      )
      .mockResolvedValueOnce("ok");

    await expect(withConversationPersistenceRetry(action)).resolves.toBe("ok");
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("does not retry for non-retryable errors", async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"));

    await expect(withConversationPersistenceRetry(action)).rejects.toThrow("boom");
    expect(action).toHaveBeenCalledTimes(1);
  });
});
