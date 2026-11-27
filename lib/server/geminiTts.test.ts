import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesizeGeminiTts } from "./geminiTts";

function wave(sample: number) {
  const bytes = Buffer.alloc(46);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(38, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(2, 40);
  bytes.writeInt16LE(sample, 44);
  return bytes;
}

function reply(data: Buffer) {
  return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", data: data.toString("base64") }] }] });
}

describe("Gemini TTS", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia texto e direção em campos separados, com os dois controles do Pampa", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(wave(13)));
    vi.stubGlobal("fetch", fetcher);
    const text = "O sino tocou.\n\nAbriu-se a janela.";
    const result = await synthesizeGeminiTts(text, "chave-sintetica", { pace: "calmo", expressiveness: "alta" }, new AbortController().signal);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/\/interactions$/);
    expect(init?.headers).toMatchObject({ "x-goog-api-key": "chave-sintetica" });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "gemini-3.8-flash-tts",
      store: false,
      generation_config: { speech_config: [{ voice: "Charon" }] },
      input: [{ content: [{ text, annotations: [{ type: "speech_metadata" }] }] }],
    });
    const style = body.input[0].content[0].annotations[0].style;
    expect(style).toMatch(/fronteira do Rio Grande do Sul/);
    expect(style).toMatch(/Ritmo calmo e pausado/);
    expect(style).toMatch(/altamente expressiva/);
    expect(Buffer.from(result)).toEqual(wave(13));
  });

  it("combina trechos em um único WAV na ordem do texto", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(wave(11))).mockResolvedValueOnce(reply(wave(22)));
    vi.stubGlobal("fetch", fetcher);
    const first = `${"Mate quente. ".repeat(110).trim()} Fim do primeiro parágrafo.`;
    const second = "A conversa da tarde seguiu na varanda por bastante tempo.";
    const result = Buffer.from(await synthesizeGeminiTts(`${first}\n\n${second}`, "chave", { pace: "natural", expressiveness: "equilibrada" }, new AbortController().signal));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.readUInt32LE(40)).toBe(4);
    expect([result.readInt16LE(44), result.readInt16LE(46)]).toEqual([11, 22]);
  });

  it("rejeita resposta sem áudio WAV válido", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(reply(Buffer.from("não é WAV"))));
    await expect(synthesizeGeminiTts("Texto", "chave", { pace: "natural", expressiveness: "suave" }, new AbortController().signal)).rejects.toThrow(/áudio WAV inválido/);
  });
});
