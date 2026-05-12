import { describe, expect, it } from "vitest";
import { buildInputFromMessages } from "@/lib/openai/buildInput";
import type { Message } from "@/types";

// Base64 com pelo menos 100 chars para passar no filtro isValidImageDataUrl
const FAKE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/H4AABQIAos4DGciqnO0AAAAASUVORK5CYII=";

const FAKE_DATA_URL = `data:image/png;base64,${FAKE_BASE64}`;
const FAKE_THUMB_URL = `data:image/jpeg;base64,${FAKE_BASE64.slice(0, 30)}`;

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
            dataUrl: FAKE_DATA_URL,
            thumbnailUrl: FAKE_THUMB_URL,
          },
        ],
      },
    ];

    expect(buildInputFromMessages(messages)[0].content).toEqual([
      { type: "input_text", text: "Analisa" },
      { type: "input_image", image_url: FAKE_DATA_URL },
    ]);
  });

  it("does not send images when dataUrl is undefined (persisted state)", () => {
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
            // dataUrl removido pela sanitizacao de storage
          },
        ],
      },
    ];

    expect(buildInputFromMessages(messages)).toEqual([
      { role: "user", content: "Analisa" },
    ]);
  });

  it("does not send images when dataUrl is too short (thumbnail-only)", () => {
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
            dataUrl: `data:image/jpeg;base64,${FAKE_BASE64.slice(0, 30)}`,
            thumbnailUrl: `data:image/jpeg;base64,${FAKE_BASE64.slice(0, 30)}`,
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

  it("ignores sanitized placeholder extractedText from storage", () => {
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
            extractedText: "[12345 chars]",
          },
        ],
      },
    ];

    // Placeholder deve ser ignorado — conteudo permanece so o texto do usuario
    expect(buildInputFromMessages(messages)).toEqual([
      {
        role: "user",
        content: "Resume",
      },
    ]);
  });
});
