import { describe, expect, it } from "vitest";
import {
  SOUNDCASE_MAX_DURATION_SECONDS,
  assertSoundCaseDuration,
  estimateSoundCaseDuration,
  normalizeSoundCaseText,
  segmentSoundCaseText,
} from "@/lib/soundcase/text";
import {
  SOUNDCASE_AUDIO_FORMAT_OVERRIDES,
  SOUNDCASE_DEFAULT_AUDIO_FORMAT,
  SOUNDCASE_INTERMEDIATE_AUDIO_FORMAT,
} from "@/lib/soundcase/types";

describe("SoundCase text", () => {
  it("keeps final and intermediate format policy explicit", () => {
    expect(SOUNDCASE_DEFAULT_AUDIO_FORMAT).toBe("mp3");
    expect(SOUNDCASE_AUDIO_FORMAT_OVERRIDES).toEqual(["flac", "wav"]);
    expect(SOUNDCASE_INTERMEDIATE_AUDIO_FORMAT).toBe("flac");
  });

  it("segments without losing narratable text order", () => {
    const source = "Primeiro parágrafo. Ainda primeiro.\n\nSegundo parágrafo.";
    const segments = segmentSoundCaseText(source, { maxChars: 48 });

    expect(segments.map((item) => item.text).join("\n\n")).toBe(source);
    expect(segments.map((item) => item.index)).toEqual([0, 1]);
    expect(segments.every((item) => item.textHash.length === 64)).toBe(true);
  });

  it("keeps deterministic UTF-16 offsets after newline normalization", () => {
    const source = "🧉 Um parágrafo.\r\n\r\nOutro parágrafo.";
    const normalized = normalizeSoundCaseText(source);
    const first = segmentSoundCaseText(source, { maxChars: 80 });
    const second = segmentSoundCaseText(source, { maxChars: 80 });

    expect(normalized).toBe("🧉 Um parágrafo.\n\nOutro parágrafo.");
    expect(first).toEqual(second);
    expect(first.map((item) => normalized.slice(item.start, item.end))).toEqual(
      first.map((item) => item.text)
    );
  });

  it("splits oversized paragraphs at sentences and then spaces", () => {
    const source =
      "Frase curta. Segunda frase ainda cabe. " +
      "palavra ".repeat(16).trim();
    const segments = segmentSoundCaseText(source, { maxChars: 44 });

    expect(segments.length).toBeGreaterThan(2);
    expect(segments.every((item) => item.text.length <= 44)).toBe(true);
    expect(segments.map((item) => item.text).join(" ")).toBe(source);
  });

  it("splits a single oversized token deterministically without data loss", () => {
    const source = "abcdefghij";
    const segments = segmentSoundCaseText(source, { maxChars: 4 });

    expect(segments.map((item) => item.text)).toEqual(["abcd", "efgh", "ij"]);
    expect(segments.map((item) => item.text).join("")).toBe(source);
  });

  it("returns no segments for blank text and rejects an invalid limit", () => {
    expect(segmentSoundCaseText(" \r\n ", { maxChars: 20 })).toEqual([]);
    expect(() => segmentSoundCaseText("texto", { maxChars: 0 })).toThrowError(
      expect.objectContaining({ code: "soundcase_segment_limit" })
    );
  });

  it("estimates duration with bounded speed", () => {
    const source = Array.from({ length: 150 }, () => "palavra").join(" ");

    expect(estimateSoundCaseDuration(source, 1)).toBe(60);
    expect(estimateSoundCaseDuration(source, Number.POSITIVE_INFINITY)).toBe(15);
    expect(estimateSoundCaseDuration(source, Number.NaN)).toBe(60);
  });

  it("rejects estimates above ninety minutes", () => {
    const source = Array.from({ length: 13_501 }, () => "palavra").join(" ");

    expect(() => assertSoundCaseDuration(source, 1)).toThrowError(
      expect.objectContaining({
        code: "soundcase_duration_limit",
        estimatedDurationSeconds: SOUNDCASE_MAX_DURATION_SECONDS + 1,
      })
    );
  });

  it("accepts the exact ninety-minute ceiling", () => {
    const source = Array.from({ length: 13_500 }, () => "palavra").join(" ");

    expect(assertSoundCaseDuration(source, 1)).toBe(
      SOUNDCASE_MAX_DURATION_SECONDS
    );
  });
});
