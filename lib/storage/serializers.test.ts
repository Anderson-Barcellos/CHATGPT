import { describe, expect, it } from "vitest";
import { deserializeConversation, serializeConversation } from "@/lib/storage/serializers";
import { Conversation } from "@/types";

describe("conversation serializers", () => {
  it("round-trips dates for conversations and messages", () => {
    const source: Conversation = {
      id: "conv-1",
      title: "Teste",
      createdAt: new Date("2026-04-01T12:00:00.000Z"),
      updatedAt: new Date("2026-04-01T12:30:00.000Z"),
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Oi",
          timestamp: new Date("2026-04-01T12:05:00.000Z"),
        },
      ],
    };

    const serialized = serializeConversation(source);
    const restored = deserializeConversation(serialized);

    expect(serialized.createdAt).toBe("2026-04-01T12:00:00.000Z");
    expect(serialized.messages[0]?.timestamp).toBe("2026-04-01T12:05:00.000Z");
    expect(restored.createdAt).toBeInstanceOf(Date);
    expect(restored.updatedAt).toBeInstanceOf(Date);
    expect(restored.messages[0]?.timestamp).toBeInstanceOf(Date);
    expect(restored.messages[0]?.content).toBe("Oi");
  });
});
