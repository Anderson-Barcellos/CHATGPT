import { GEMINI_TTS_MODEL, GEMINI_TTS_PROFILE, geminiTtsStyle, type GeminiTtsSettings } from "../tts/geminiTts";

const CHUNK_LIMIT = 1500;
const SAMPLE_RATE = 24_000;
const MAX_AUDIO_BYTES = 96 * 1024 * 1024;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export class GeminiTtsError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

function splitText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > CHUNK_LIMIT) {
    const head = rest.slice(0, CHUNK_LIMIT);
    const boundaries = [head.lastIndexOf("\n"), head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? ")];
    const natural = Math.max(...boundaries);
    let end = natural >= CHUNK_LIMIT / 2 ? natural + 1 : head.lastIndexOf(" ");
    if (end < CHUNK_LIMIT / 2) end = /[\uD800-\uDBFF]$/.test(head) ? CHUNK_LIMIT - 1 : CHUNK_LIMIT;
    chunks.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function wavSamples(wav: Buffer): Buffer {
  const invalid = () => new GeminiTtsError("O Gemini devolveu áudio WAV inválido.");
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") throw invalid();
  let formatChecked = false;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wav.length) throw invalid();
    if (tag === "fmt ") {
      if (size < 16 || wav.readUInt16LE(start) !== 1 || wav.readUInt16LE(start + 2) !== 1
        || wav.readUInt32LE(start + 4) !== SAMPLE_RATE || wav.readUInt16LE(start + 14) !== 16) throw invalid();
      formatChecked = true;
    } else if (tag === "data") {
      if (!formatChecked || !size || size % 2) throw invalid();
      return wav.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  throw invalid();
}

function joinWav(samples: Buffer[], size: number): Uint8Array<ArrayBuffer> {
  const wav = Buffer.alloc(44 + size);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + size, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(size, 40);
  let offset = 44;
  for (const chunk of samples) offset += chunk.copy(wav, offset);
  return wav;
}

type Interaction = {
  status?: string;
  steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
};

export async function synthesizeGeminiTts(text: string, apiKey: string, settings: GeminiTtsSettings, signal: AbortSignal) {
  const style = geminiTtsStyle(settings);
  const samples: Buffer[] = [];
  let size = 0;
  for (const chunk of splitText(text)) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      body: JSON.stringify({
        model: GEMINI_TTS_MODEL,
        store: false,
        input: [{ type: "user_input", content: [{ type: "text", text: chunk, annotations: [{ type: "speech_metadata", style }] }] }],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: GEMINI_TTS_PROFILE.voice }] },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.warn(`Gemini TTS: o Google respondeu ${response.status} para um trecho de ${chunk.length} caracteres.`);
      if (response.status === 429) throw new GeminiTtsError("O limite do Gemini TTS foi atingido. Tente em instantes.", 429);
      throw new GeminiTtsError("O Gemini TTS não conseguiu gerar o áudio.");
    }
    const result = await response.json() as Interaction;
    const audio = result.steps?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? []).filter((item) => item.type === "audio");
    if (result.status !== "completed" || !audio?.length || audio.some((item) => !item.data)) {
      throw new GeminiTtsError("O Gemini TTS não concluiu a geração do áudio.");
    }
    for (const item of audio) {
      const pcm = wavSamples(Buffer.from(item.data!, "base64"));
      size += pcm.length;
      if (size > MAX_AUDIO_BYTES) throw new GeminiTtsError("O áudio excedeu o tamanho permitido.");
      samples.push(pcm);
    }
  }
  if (!size) throw new GeminiTtsError("O Gemini TTS não devolveu áudio.");
  return joinWav(samples, size);
}
