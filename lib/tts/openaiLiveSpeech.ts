export const OPENAI_LIVE_SPEECH_LIMIT = 240;

// Ignore presentation punctuation while retaining signs, decimal separators and percentages.
export function normalizeLiveTranscript(text: string): string {
  return (text.normalize("NFC").toLocaleLowerCase("pt-BR").replace(/−/g, "-")
    .match(/[+-]?\d+(?:[.,:/]\d+)*(?:\s*%)?|\p{L}[\p{L}\p{M}]*/gu) ?? [])
    .map((token) => token.replace(/\s+%$/, "%"))
    .join(" ");
}

// Vozes conferidas na documentação do GPT-Live (audio.output.voice); Marin é o padrão do provedor.
export const OPENAI_LIVE_VOICES = [
  { id: "marin", label: "Marin · padrão" },
  { id: "bossa", label: "Bossa · brasileira" },
  { id: "tempo", label: "Tempo · brasileiro" },
] as const;
export type OpenAILiveVoice = (typeof OPENAI_LIVE_VOICES)[number]["id"];

// O GPT-Live não tem campo de velocidade: o ritmo vira um pedido nas instruções da sessão.
export const OPENAI_LIVE_PACES = [
  { id: "natural", label: "Natural" },
  { id: "calmo", label: "Calmo" },
  { id: "agil", label: "Ágil" },
] as const;
export type OpenAILivePace = (typeof OPENAI_LIVE_PACES)[number]["id"];

export interface OpenAILiveSettings { voice: OpenAILiveVoice; pace: OpenAILivePace }
export const DEFAULT_OPENAI_LIVE_SETTINGS: OpenAILiveSettings = { voice: "marin", pace: "natural" };

export function normalizeOpenAILiveSettings(value: unknown): OpenAILiveSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_OPENAI_LIVE_SETTINGS;
  const { voice, pace } = value as Record<string, unknown>;
  return {
    voice: OPENAI_LIVE_VOICES.some(({ id }) => id === voice) ? voice as OpenAILiveVoice : DEFAULT_OPENAI_LIVE_SETTINGS.voice,
    pace: OPENAI_LIVE_PACES.some(({ id }) => id === pace) ? pace as OpenAILivePace : DEFAULT_OPENAI_LIVE_SETTINGS.pace,
  };
}

export function openAILivePaceInstruction(pace: OpenAILivePace): string {
  if (pace === "calmo") return "Fale um pouco mais devagar que o normal, com pausas claras entre as frases.";
  if (pace === "agil") return "Fale um pouco mais rápido que o normal, sem engolir palavras.";
  return "";
}
