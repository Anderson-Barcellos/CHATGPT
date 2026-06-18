import { describe, expect, it } from "vitest";
import type { Conversation } from "@/types";
import {
  chunkConversation,
  getConversationContentHash,
  messageToRetrievalText,
} from "@/lib/server/memory/chunking";

function conversationFixture(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    title: "Memoria RAG",
    createdAt: new Date("2026-06-17T10:00:00.000Z"),
    updatedAt: new Date("2026-06-17T10:05:00.000Z"),
    messages: [],
    ...overrides,
  };
}

describe("memory chunking", () => {
  it("ignores incomplete assistant messages and sanitized attachment placeholders", () => {
    const conversation = conversationFixture({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Anders prefere revisar memorias antes de ativar.",
          timestamp: new Date("2026-06-17T10:01:00.000Z"),
          attachments: [
            {
              id: "att-1",
              name: "placeholder.txt",
              type: "text",
              mimeType: "text/plain",
              size: 1234,
              extractedText: "[1234 chars]",
            },
          ],
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Resposta ainda em andamento",
          timestamp: new Date("2026-06-17T10:02:00.000Z"),
          streamStatus: "streaming",
        },
      ],
    });

    const chunks = chunkConversation(conversation);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkText).toContain("revisar memorias");
    expect(chunks[0].chunkText).not.toContain("1234 chars");
    expect(chunks[0].chunkText).not.toContain("andamento");
  });

  it("includes real extracted attachment text", () => {
    const text = messageToRetrievalText({
      id: "user-1",
      role: "user",
      content: "Analisa o arquivo.",
      timestamp: new Date("2026-06-17T10:01:00.000Z"),
      attachments: [
        {
          id: "att-1",
          name: "notas.md",
          type: "text",
          mimeType: "text/markdown",
          size: 42,
          extractedText: "Preferencia nova: manter respostas em prosa.",
        },
      ],
    });

    expect(text).toContain("Analisa o arquivo.");
    expect(text).toContain("Preferencia nova");
  });

  it("changes the conversation hash when durable content changes", () => {
    const base = conversationFixture({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Primeira versao",
          timestamp: new Date("2026-06-17T10:01:00.000Z"),
        },
      ],
    });
    const changed = conversationFixture({
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "Segunda versao",
          timestamp: new Date("2026-06-17T10:01:00.000Z"),
        },
      ],
    });

    expect(getConversationContentHash(base)).not.toBe(
      getConversationContentHash(changed)
    );
  });
});
