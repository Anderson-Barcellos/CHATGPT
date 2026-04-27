import { describe, expect, it } from "vitest";
import { buildInputFromMessages } from "@/lib/openai/buildInput";
import type { Message } from "@/types";

describe("buildInputFromMessages", () => {
  it("includes fresh image attachments as input_image parts", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Analisa",
        timestamp: new Date("2026-04-24T10:00:00.000Z"),
        attachments: [
          {
            id: "img-1",
            name: "exame.png",
            type: "image",
            mimeType: "image/png",
            size: 100,
            dataUrl: "data:image/png;base64,full",
            thumbnailUrl: "data:image/jpeg;base64,thumb",
          },
        ],
      },
    ];

    expect(buildInputFromMessages(messages)[0].content).toEqual([
      { type: "input_text", text: "Analisa" },
      { type: "input_image", image_url: "data:image/png;base64,full" },
    ]);
  });

  it("does not send persisted thumbnails back as model images", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Analisa",
        timestamp: new Date("2026-04-24T10:00:00.000Z"),
        attachments: [
          {
            id: "img-1",
            name: "exame.png",
            type: "image",
            mimeType: "image/png",
            size: 100,
            dataUrl: "data:image/jpeg;base64,thumb",
            thumbnailUrl: "data:image/jpeg;base64,thumb",
          },
        ],
      },
    ];

    expect(buildInputFromMessages(messages)).toEqual([
      { role: "user", content: "Analisa" },
    ]);
  });

  it("keeps extracted text attachments in the text content", () => {
    const messages: Message[] = [
      {
        id: "msg-1",
        role: "user",
        content: "Resume",
        timestamp: new Date("2026-04-24T10:00:00.000Z"),
        attachments: [
          {
            id: "txt-1",
            name: "notas.txt",
            type: "text",
            mimeType: "text/plain",
            size: 100,
            extractedText: "conteudo extraido",
          },
        ],
      },
    ];

    expect(buildInputFromMessages(messages)).toEqual([
      {
        role: "user",
        content: "Resume\n\n[Arquivo: notas.txt]\nconteudo extraido",
      },
    ]);
  });
});
