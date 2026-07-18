import { describe, expect, it } from "vitest";
import { exportToPDF } from "./pdf";
import type { Conversation } from "@/types";

describe("conversation PDF export", () => {
  it("creates a non-empty PDF with jsPDF 4", async () => {
    const now = new Date("2026-07-11T12:00:00Z");
    const conversation: Conversation = {
      id: "pdf-test",
      title: "Gaucho Chat",
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: "message-test",
          role: "assistant",
          content: "PDF funcionando.",
          timestamp: now,
        },
      ],
    };

    const document = await exportToPDF(conversation);
    const bytes = document.output("arraybuffer").byteLength;

    expect(bytes).toBeGreaterThan(500);
  });
});
