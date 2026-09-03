import { describe, expect, it } from "vitest";
import {
  DEFAULT_TTS_INSTRUCTIONS,
  DEFAULT_TTS_PREFERENCES,
  REALTIME_TTS_VOICES,
  TTS_VOICES,
  normalizeTtsPreferences,
  sanitizeSpeechText,
  splitSpeechText,
} from "@/lib/tts/speechText";

describe("speech text helpers", () => {
  it("offers only voices shared by standard TTS and Realtime", () => {
    expect(TTS_VOICES).toEqual(REALTIME_TTS_VOICES);
    expect(TTS_VOICES).toEqual([
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
      "marin",
      "cedar",
    ]);
    expect(normalizeTtsPreferences({ voice: "fable" }).voice).toBe("marin");
    expect(normalizeTtsPreferences({ voice: "nova" }).voice).toBe("marin");
    expect(normalizeTtsPreferences({ voice: "onyx" }).voice).toBe("marin");
  });

  it("sanitizes markdown into readable speech text", () => {
    expect(
      sanitizeSpeechText(
        "# Título\n\n- Veja [OpenAI](https://openai.com)\n\n```ts\nconst a = 1;\n```"
      )
    ).toBe("Título Veja OpenAI bloco de código omitido.");
  });

  it("splits long text on sentence boundaries", () => {
    const chunks = splitSpeechText("Primeira frase. Segunda frase. Terceira frase.", 32);

    expect(chunks).toEqual(["Primeira frase. Segunda frase.", "Terceira frase."]);
  });

  it("uses a shorter first chunk in turbo mode", () => {
    const text = [
      "Primeira frase curta para iniciar logo.",
      "Segunda frase com um pouco mais de conteúdo para continuar a narração.",
      "Terceira frase mantém o restante em partes maiores.",
    ].join(" ");
    const chunks = splitSpeechText(text, { mode: "turbo" });

    expect(chunks[0].length).toBeLessThanOrEqual(500);
    expect(chunks.join(" ")).toBe(text);
  });

  it("keeps balanced chunks larger than turbo chunks for the same text", () => {
    const text = "Frase de teste com conteúdo suficiente para ocupar espaço. ".repeat(25);
    const turboChunks = splitSpeechText(text, { mode: "turbo" });
    const balancedChunks = splitSpeechText(text, { mode: "balanced" });

    expect(turboChunks.length).toBeGreaterThan(balancedChunks.length);
    expect(balancedChunks.every((chunk) => chunk.length <= 1600)).toBe(true);
    expect(turboChunks.every((chunk, index) => chunk.length <= (index === 0 ? 500 : 900))).toBe(true);
  });

  it("splits oversized sentences without exceeding the limit", () => {
    const chunks = splitSpeechText("palavra ".repeat(30), 50);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 50)).toBe(true);
  });

  it("ships non-empty default reading instructions within the 1200-char limit", () => {
    expect(DEFAULT_TTS_INSTRUCTIONS.trim().length).toBeGreaterThan(0);
    expect(DEFAULT_TTS_INSTRUCTIONS.length).toBeLessThanOrEqual(1200);
    expect(DEFAULT_TTS_PREFERENCES.instructions).toBe(DEFAULT_TTS_INSTRUCTIONS);
    expect(normalizeTtsPreferences(undefined).instructions).toBe(
      DEFAULT_TTS_INSTRUCTIONS
    );
    expect(normalizeTtsPreferences({ instructions: "" }).instructions).toBe("");
    expect(
      normalizeTtsPreferences({ instructions: "Leitura neutra." }).instructions
    ).toBe("Leitura neutra.");
  });

  it("normalizes invalid preferences to safe defaults", () => {
    expect(
      normalizeTtsPreferences({
        model: "gpt-4o-mini-tts",
        voice: "not-a-voice",
        speed: 10,
        instructions: "fala".repeat(400),
        format: "wav",
      })
    ).toEqual({
      ...DEFAULT_TTS_PREFERENCES,
      speed: 4,
      instructions: "fala".repeat(400).slice(0, 1200),
      mode: "turbo",
      format: "wav",
    });
  });
});
