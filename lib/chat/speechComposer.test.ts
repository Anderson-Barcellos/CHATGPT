import { describe, expect, it } from "vitest";
import { composeSpeechTranscriptPreview } from "@/lib/chat/speechComposer";

describe("composeSpeechTranscriptPreview", () => {
  it("returns the transcript directly when the composer was empty", () => {
    expect(composeSpeechTranscriptPreview("", "texto transcrito")).toBe(
      "texto transcrito"
    );
  });

  it("separates an existing message from the incremental transcript", () => {
    expect(composeSpeechTranscriptPreview("contexto existente", "fala parcial")).toBe(
      "contexto existente\nfala parcial"
    );
  });

  it("does not duplicate an existing trailing newline", () => {
    expect(composeSpeechTranscriptPreview("contexto existente\n", "fala parcial")).toBe(
      "contexto existente\nfala parcial"
    );
  });
});
