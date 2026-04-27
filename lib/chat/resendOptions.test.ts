import { describe, expect, it } from "vitest";
import { buildEditResendOptions } from "@/lib/chat/resendOptions";
import type { Message } from "@/types";

describe("buildEditResendOptions", () => {
  it("preserves response mode and attachments from the original message", () => {
    const originalMessage: Message = {
      id: "user-1",
      role: "user",
      content: "Analisa essa imagem",
      timestamp: new Date("2026-04-24T10:00:00.000Z"),
      responseMode: "document",
      attachments: [
        {
          id: "img-1",
          name: "exame.png",
          type: "image",
          mimeType: "image/png",
          size: 1234,
          dataUrl: "data:image/png;base64,full",
          thumbnailUrl: "data:image/jpeg;base64,thumb",
        },
      ],
    };

    expect(buildEditResendOptions(originalMessage)).toEqual({
      responseMode: "document",
      attachments: originalMessage.attachments,
    });
  });

  it("returns empty options when the original message is missing", () => {
    expect(buildEditResendOptions(undefined)).toEqual({});
  });
});
