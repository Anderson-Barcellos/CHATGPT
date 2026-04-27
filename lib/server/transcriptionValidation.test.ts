import { describe, expect, it } from "vitest";
import { validateTranscriptionFile } from "@/lib/server/transcriptionValidation";

describe("validateTranscriptionFile", () => {
  it("rejects empty audio files", () => {
    const file = new File([], "empty.webm", { type: "audio/webm" });

    expect(validateTranscriptionFile(file)).toEqual({
      ok: false,
      status: 400,
      error: "O audio chegou vazio para transcricao.",
    });
  });

  it("rejects non-audio files", () => {
    const file = new File(["texto"], "note.txt", { type: "text/plain" });

    expect(validateTranscriptionFile(file)).toEqual({
      ok: false,
      status: 400,
      error: "Formato de audio nao suportado.",
    });
  });

  it("rejects audio files larger than 25 MB", () => {
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "big.webm", {
      type: "audio/webm",
    });

    expect(validateTranscriptionFile(file)).toEqual({
      ok: false,
      status: 413,
      error: "Arquivo de audio muito grande. O limite e 25MB.",
    });
  });

  it("accepts audio files within the limit", () => {
    const file = new File(["audio"], "ok.webm", { type: "audio/webm" });

    expect(validateTranscriptionFile(file)).toEqual({ ok: true });
  });
});
