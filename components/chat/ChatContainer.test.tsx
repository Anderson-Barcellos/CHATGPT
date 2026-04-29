import { describe, expect, it } from "vitest";
import { getChatMessageRenderKey } from "@/components/chat/ChatContainer";
import type { Message } from "@/types";

describe("getChatMessageRenderKey", () => {
  it("keeps the assistant bubble mounted when an artifact is attached", () => {
    const baseMessage: Message = {
      id: "assistant-1",
      role: "assistant",
      content: "Texto em stream",
      timestamp: new Date("2026-04-28T12:00:00.000Z"),
      streamStatus: "streaming",
    };

    const completedWithArtifact: Message = {
      ...baseMessage,
      content: "Resumo do documento",
      streamStatus: "completed",
      artifact: {
        id: "artifact-1",
        kind: "document",
        title: "Documento",
        summary: "Resumo do documento",
        displayMode: "document",
        content: "# Documento\n\nTexto final",
        type: "markdown",
      },
    };

    expect(getChatMessageRenderKey(baseMessage)).toBe("assistant-1");
    expect(getChatMessageRenderKey(completedWithArtifact)).toBe("assistant-1");
  });
});
