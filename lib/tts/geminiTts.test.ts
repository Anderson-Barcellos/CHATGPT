import { describe, expect, it } from "vitest";
import { joinGeminiWavs, splitGeminiSpeechText } from "./geminiTts";

const frase = "O Doppler mede a velocidade do fluxo pelo desvio de frequência do eco. ";

describe("fatiamento do Gemini TTS para leitura em partes", () => {
  it("mantém texto curto em uma parte só", () => {
    expect(splitGeminiSpeechText("Bah, que tarde linda.")).toEqual(["Bah, que tarde linda."]);
    expect(splitGeminiSpeechText("   ")).toEqual([]);
  });

  it("começa por uma parte curta e cresce até o teto, sempre em fim de frase", () => {
    const text = frase.repeat(60).trim();
    const chunks = splitGeminiSpeechText(text);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks[0].length).toBeLessThanOrEqual(320);
    expect(chunks[1].length).toBeLessThanOrEqual(800);
    expect(chunks[1].length).toBeGreaterThan(320);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200);
      expect(chunk.endsWith(".")).toBe(true);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  it("prefere a quebra de parágrafo e não perde palavras", () => {
    const first = frase.repeat(3).trim();
    const second = frase.repeat(8).trim();
    const chunks = splitGeminiSpeechText(`${first}\n\n${second}`);
    expect(chunks[0]).toBe(first);
    expect(chunks.join(" ").split(/\s+/)).toEqual(`${first} ${second}`.split(/\s+/));
  });

  it("corta texto sem pontuação nem espaço sem partir par substituto", () => {
    const chunks = splitGeminiSpeechText("😀".repeat(400));
    expect(chunks.join("")).toBe("😀".repeat(400));
    for (const chunk of chunks) expect(/[\uD800-\uDBFF]$/.test(chunk)).toBe(false);
  });
});

describe("união dos WAVs das partes", () => {
  function wave(samples: number[]) {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(bytes.buffer);
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
    return new Blob([bytes], { type: "audio/wav" });
  }

  it("gera um WAV único de 24 kHz mono com as amostras na ordem", async () => {
    const merged = joinGeminiWavs([wave([11, 12]), wave([21])]);
    expect(merged.type).toBe("audio/wav");
    const view = new DataView(await merged.arrayBuffer());
    const tag = (offset: number) => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(4, true)).toBe(36 + 6);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([11, 12, 21]);
  });
});
