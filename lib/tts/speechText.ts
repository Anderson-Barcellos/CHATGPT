import type { TtsMode, TtsPreferences } from "@/types";

export const TTS_MODEL = "gpt-4o-mini-tts";
export const TTS_SAFE_INPUT_LIMIT = 3600;

export const TTS_CHUNKING_PROFILES: Record<
  TtsMode,
  { firstChunkLimit: number; chunkLimit: number; concurrency: number }
> = {
  balanced: {
    firstChunkLimit: 1600,
    chunkLimit: 1600,
    concurrency: 2,
  },
  turbo: {
    firstChunkLimit: 500,
    chunkLimit: 900,
    concurrency: 4,
  },
};

export const TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const REALTIME_TTS_VOICES = [
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
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number];
export type RealtimeTtsVoice = (typeof REALTIME_TTS_VOICES)[number];

export const DEFAULT_TTS_PREFERENCES: TtsPreferences = {
  model: TTS_MODEL,
  voice: "marin",
  speed: 1,
  instructions: "",
  mode: "turbo",
};

export function isTtsVoice(value: unknown): value is TtsVoice {
  return typeof value === "string" && TTS_VOICES.includes(value as TtsVoice);
}

export function normalizeRealtimeTtsVoice(value: unknown): RealtimeTtsVoice {
  return typeof value === "string" &&
    REALTIME_TTS_VOICES.includes(value as RealtimeTtsVoice)
    ? (value as RealtimeTtsVoice)
    : "marin";
}

function isTtsMode(value: unknown): value is TtsMode {
  return value === "balanced" || value === "turbo";
}

export function normalizeTtsPreferences(
  value: Partial<TtsPreferences> | null | undefined
): TtsPreferences {
  const speed =
    typeof value?.speed === "number" && Number.isFinite(value.speed)
      ? Math.min(Math.max(value.speed, 0.25), 4)
      : DEFAULT_TTS_PREFERENCES.speed;

  return {
    model: TTS_MODEL,
    voice: isTtsVoice(value?.voice) ? value.voice : DEFAULT_TTS_PREFERENCES.voice,
    speed: Number(speed.toFixed(2)),
    instructions:
      typeof value?.instructions === "string"
        ? value.instructions.slice(0, 1200)
        : DEFAULT_TTS_PREFERENCES.instructions,
    mode: isTtsMode(value?.mode) ? value.mode : DEFAULT_TTS_PREFERENCES.mode,
  };
}

export function sanitizeSpeechText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " bloco de código omitido. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitOversizedSegment(
  segment: string,
  firstLimit: number,
  nextLimit = firstLimit
): string[] {
  const chunks: string[] = [];
  let remaining = segment.trim();
  let limit = firstLimit;

  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit + 1);
    const splitAt = Math.max(
      slice.lastIndexOf(" "),
      slice.lastIndexOf(","),
      slice.lastIndexOf(";"),
      slice.lastIndexOf(":")
    );
    const end = splitAt > Math.floor(limit * 0.55) ? splitAt : limit;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
    limit = nextLimit;
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function getTtsChunkingProfile(mode: TtsMode) {
  return TTS_CHUNKING_PROFILES[mode] ?? TTS_CHUNKING_PROFILES.turbo;
}

export function splitSpeechText(
  input: string,
  options: number | { mode?: TtsMode; limit?: number } = TTS_SAFE_INPUT_LIMIT
): string[] {
  const text = sanitizeSpeechText(input);
  if (!text) return [];

  const profile =
    typeof options === "number"
      ? { firstChunkLimit: options, chunkLimit: options }
      : options.limit
      ? { firstChunkLimit: options.limit, chunkLimit: options.limit }
      : getTtsChunkingProfile(options.mode ?? DEFAULT_TTS_PREFERENCES.mode);
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const activeLimit =
      chunks.length === 0 ? profile.firstChunkLimit : profile.chunkLimit;

    if (sentence.length > activeLimit) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(
        ...splitOversizedSegment(
          sentence,
          activeLimit,
          profile.chunkLimit
        )
      );
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= activeLimit) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
