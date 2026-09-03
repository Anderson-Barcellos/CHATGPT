import type OpenAI from "openai";
import type {
  SoundCaseDirection,
  SoundCasePronunciation,
  SoundCaseSegment,
  SoundCaseSegmentDirection,
} from "@/lib/soundcase/types";
import { isTtsVoice, TTS_VOICES } from "@/lib/tts/speechText";
import { createOpenAIClient } from "@/lib/server/chatRequest";

export const SOUNDCASE_DIRECTION_PROMPT_VERSION = "soundcase-direction-v1";

export const DEFAULT_TTS_INSTRUCTIONS =
  "Leia o texto exatamente como fornecido, sem resumir, omitir, corrigir ou acrescentar conteúdo. Use dicção clara, ritmo natural, pausas coerentes com a pontuação e respeite as pronúncias indicadas.";

const SOUNDCASE_DIRECTION_MODEL = "gpt-5.6-luna" as const;
const DEFAULT_COVER_PROMPT =
  "Composição editorial abstrata inspirada em áudio e narrativa, atmosfera azul profunda, sem palavras, letras, números, legendas ou tipografia legível.";
const COVER_NO_TEXT_CONSTRAINT =
  "Obrigatório: produza somente imagem; não inclua palavras, letras, números, títulos, legendas, logotipos ou qualquer tipografia legível.";

export const soundCaseDirectionSchema = {
  type: "json_schema" as const,
  name: "soundcase_narration_direction",
  strict: true,
  description:
    "Direção editorial e vocal para narrar fielmente um texto no SoundCase.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "summary",
      "language",
      "voice",
      "speed",
      "globalInstructions",
      "pronunciations",
      "segmentDirections",
      "coverPrompt",
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      language: { type: "string" },
      voice: { type: "string", enum: [...TTS_VOICES] },
      speed: { type: "number", minimum: 0.25, maximum: 4 },
      globalInstructions: { type: "string" },
      pronunciations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "pronunciation"],
          properties: {
            term: { type: "string" },
            pronunciation: { type: "string" },
          },
        },
      },
      segmentDirections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["segmentId", "instructions"],
          properties: {
            segmentId: { type: "string" },
            instructions: { type: "string" },
          },
        },
      },
      coverPrompt: { type: "string" },
    },
  },
};

interface SoundCaseDirectionInput {
  sourceText: string;
  segments: SoundCaseSegment[];
}

interface RawDirection {
  title?: unknown;
  summary?: unknown;
  language?: unknown;
  voice?: unknown;
  speed?: unknown;
  globalInstructions?: unknown;
  pronunciations?: unknown;
  segmentDirections?: unknown;
  coverPrompt?: unknown;
}

function boundedString(value: unknown, limit: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, limit) : fallback;
}

function extractOutputText(response: unknown): string {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof (response as { output_text?: unknown }).output_text === "string"
  ) {
    return (response as { output_text: string }).output_text;
  }
  return "";
}

function parseDirection(response: unknown): RawDirection {
  const outputText = extractOutputText(response);
  if (!outputText) throw new Error("soundcase_direction_empty");
  try {
    const parsed = JSON.parse(outputText) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("soundcase_direction_invalid");
    }
    return parsed as RawDirection;
  } catch {
    throw new Error("soundcase_direction_json_invalid");
  }
}

function normalizePronunciations(value: unknown): SoundCasePronunciation[] {
  if (!Array.isArray(value)) return [];
  const pronunciations: SoundCasePronunciation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const term = boundedString((item as { term?: unknown }).term, 160);
    const pronunciation = boundedString(
      (item as { pronunciation?: unknown }).pronunciation,
      240
    );
    if (term && pronunciation) pronunciations.push({ term, pronunciation });
    if (pronunciations.length === 80) break;
  }
  return pronunciations;
}

function normalizeSegmentDirections(
  value: unknown,
  segments: SoundCaseSegment[],
  globalInstructions: string
): SoundCaseSegmentDirection[] {
  const supplied = new Map<string, string>();
  const knownIds = new Set(segments.map((segment) => segment.id));
  if (!Array.isArray(value)) throw new Error("soundcase_segment_directions_invalid");

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("soundcase_segment_direction_invalid");
    }
    const segmentId = (item as { segmentId?: unknown }).segmentId;
    if (
      typeof segmentId !== "string" ||
      !knownIds.has(segmentId) ||
      supplied.has(segmentId)
    ) {
      throw new Error("soundcase_segment_id_invalid");
    }
    supplied.set(
      segmentId,
      protectNarrationInstruction(
        (item as { instructions?: unknown }).instructions,
        500,
        globalInstructions
      )
    );
  }

  return segments.map((segment) => ({
    segmentId: segment.id,
    instructions: supplied.get(segment.id) ?? globalInstructions,
  }));
}

function normalizeAutomaticDirection(
  raw: RawDirection,
  input: SoundCaseDirectionInput
): SoundCaseDirection {
  if (!isTtsVoice(raw.voice)) throw new Error("soundcase_voice_invalid");
  const globalInstructions = protectNarrationInstruction(
    raw.globalInstructions,
    1_200,
    DEFAULT_TTS_INSTRUCTIONS
  );
  const speed =
    typeof raw.speed === "number" && Number.isFinite(raw.speed)
      ? Math.min(4, Math.max(0.25, raw.speed))
      : 1;

  return {
    model: SOUNDCASE_DIRECTION_MODEL,
    promptVersion: SOUNDCASE_DIRECTION_PROMPT_VERSION,
    source: "automatic",
    title: boundedString(raw.title, 120, "SoundCase"),
    summary: boundedString(raw.summary, 600),
    language: boundedString(raw.language, 80, "pt-BR"),
    voice: raw.voice,
    speed,
    globalInstructions,
    pronunciations: normalizePronunciations(raw.pronunciations),
    segmentDirections: normalizeSegmentDirections(
      raw.segmentDirections,
      input.segments,
      globalInstructions
    ),
    coverPrompt: normalizeCoverPrompt(raw.coverPrompt, input.sourceText),
  };
}

function protectNarrationInstruction(
  value: unknown,
  limit: number,
  fallback: string
): string {
  const artistic = boundedString(value, limit);
  if (!artistic || artistic === DEFAULT_TTS_INSTRUCTIONS) return fallback;
  const separator = "\n\n";
  const available = Math.max(0, limit - DEFAULT_TTS_INSTRUCTIONS.length - separator.length);
  return `${artistic.slice(0, available)}${separator}${DEFAULT_TTS_INSTRUCTIONS}`;
}

function containsSourceExcerpt(prompt: string, sourceText: string): boolean {
  const normalize = (value: string) =>
    value.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const promptWords = normalize(prompt).split(" ").filter(Boolean);
  const sourceWords = normalize(sourceText).split(" ").filter(Boolean);
  if (sourceWords.length === 0) return false;
  const windows = sourceWords.length < 3 ? [sourceWords.join(" ")] : sourceWords
    .slice(0, -2)
    .map((_, index) => sourceWords.slice(index, index + 3).join(" "));
  const normalizedPrompt = promptWords.join(" ");
  return windows.some((window) => window.length >= 12 && normalizedPrompt.includes(window));
}

function normalizeCoverPrompt(value: unknown, sourceText: string): string {
  const rawPrompt = boundedString(value, 1_200);
  if (!rawPrompt || containsSourceExcerpt(rawPrompt, sourceText)) {
    return DEFAULT_COVER_PROMPT;
  }
  const unsafeProbe = rawPrompt
    .replace(/\b(?:sem|without|no)\s+(?:texto|text|palavras?|words?|letras?|letters?|t[ií]tulos?|titles?|legendas?|captions?|tipografia|typography)\b/giu, "")
    .toLocaleLowerCase("pt-BR");
  if (/\b(?:escrev\p{L}*|write|spell|texto|text|palavras?|words?|letras?|letters?|t[ií]tulos?|titles?|legendas?|captions?|tipografia|typography)\b/iu.test(unsafeProbe)) {
    return DEFAULT_COVER_PROMPT;
  }
  const separator = "\n\n";
  const available = 1_200 - COVER_NO_TEXT_CONSTRAINT.length - separator.length;
  return `${rawPrompt.slice(0, available)}${separator}${COVER_NO_TEXT_CONSTRAINT}`;
}

function fallbackTitle(sourceText: string): string {
  const firstLine = sourceText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine?.replace(/^#{1,6}\s+/u, "") || "SoundCase").slice(0, 120);
}

export function buildFallbackSoundCaseDirection(
  input: SoundCaseDirectionInput
): SoundCaseDirection {
  const summary = input.sourceText.replace(/\s+/gu, " ").trim().slice(0, 240);
  return {
    model: SOUNDCASE_DIRECTION_MODEL,
    promptVersion: SOUNDCASE_DIRECTION_PROMPT_VERSION,
    source: "fallback",
    title: fallbackTitle(input.sourceText),
    summary,
    language: "pt-BR",
    voice: "marin",
    speed: 1,
    globalInstructions: DEFAULT_TTS_INSTRUCTIONS,
    pronunciations: [],
    segmentDirections: input.segments.map((segment) => ({
      segmentId: segment.id,
      instructions: DEFAULT_TTS_INSTRUCTIONS,
    })),
    coverPrompt: DEFAULT_COVER_PROMPT,
  };
}

function buildDirectionInstructions(): string {
  return `Tu és o diretor de narração editorial do SoundCase.

Regras obrigatórias:
- Analisa o texto, mas nunca devolve, resume para narração, reescreve ou acrescenta texto narrado.
- Produz apenas metadados de direção no schema solicitado.
- Usa somente IDs de segmentos recebidos; omite direções específicas quando a global basta.
- Escolhe uma voz exclusivamente da enum fornecida pelo schema.
- globalInstructions e instruções de segmento descrevem interpretação, tom, energia, ritmo e pausas.
- pronunciations contém somente termos realmente difíceis e uma orientação clara de pronúncia.
- coverPrompt descreve arte abstrata coerente com o conteúdo, sem palavras, letras, números, legendas ou tipografia legível.
- Preserva integralmente a intenção e o idioma do autor.`;
}

function buildDirectionInput(segments: SoundCaseSegment[]): string {
  return JSON.stringify({
    segments: segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
    })),
  });
}

export async function directSoundCase(
  input: SoundCaseDirectionInput,
  client: OpenAI | null = createOpenAIClient()
): Promise<SoundCaseDirection> {
  if (!client) return buildFallbackSoundCaseDirection(input);
  try {
    const response = await client.responses.create({
      model: SOUNDCASE_DIRECTION_MODEL,
      instructions: buildDirectionInstructions(),
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: buildDirectionInput(input.segments) }],
        },
      ],
      reasoning: { effort: "low" },
      max_output_tokens: 3_200,
      store: false,
      text: { format: soundCaseDirectionSchema },
    });
    return normalizeAutomaticDirection(parseDirection(response), input);
  } catch {
    return buildFallbackSoundCaseDirection(input);
  }
}
