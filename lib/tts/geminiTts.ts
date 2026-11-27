export const GEMINI_TTS_TEXT_LIMIT = 20_000;
export const GEMINI_TTS_REQUEST_TIMEOUT_MS = 270_000;
export const GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
export const GEMINI_TTS_PROFILE = {
  label: "Fronteira Técnica",
  voice: "Charon",
  style: "Leia em português brasileiro com sotaque gaúcho da fronteira do Rio Grande do Sul, tom caloroso de conterrâneo que conversa com um amigo, e didática de professor que explica com calma para quem está construindo junto. Pronuncie termos técnicos, siglas e palavras em inglês com clareza e naturalidade, sem aportuguesar nem tropeçar. Leia números, unidades e medidas por extenso e sem pressa. Marque com pausa breve as mudanças de ideia e os fins de parágrafo, dê leve ênfase às conclusões e mantenha um ritmo narrativo firme e envolvente, sem soar como locução comercial nem caricatura.",
} as const;

export const GEMINI_TTS_PACES = {
  calmo: { label: "Calma", style: "Ritmo calmo e pausado, com respiros claros entre frases." },
  natural: { label: "Natural", style: "Ritmo natural e fluido de fala cotidiana." },
  dinamico: { label: "Dinâmica", style: "Ritmo ágil, vivo e dinâmico, mantendo dicção nítida." },
};

export const GEMINI_TTS_EXPRESSIVENESS = {
  suave: { label: "Suave", style: "Entonação serena e contida." },
  equilibrada: { label: "Equilibrada", style: "Entonação expressiva e natural." },
  alta: { label: "Alta", style: "Entonação rica, calorosa e altamente expressiva nas ênfases." },
};

export interface GeminiTtsSettings {
  pace: keyof typeof GEMINI_TTS_PACES;
  expressiveness: keyof typeof GEMINI_TTS_EXPRESSIVENESS;
}

export function normalizeGeminiTtsSettings(value: unknown): GeminiTtsSettings {
  const { pace, expressiveness } = (value ?? {}) as Record<string, unknown>;
  return {
    pace: pace === "calmo" ? "calmo" : pace === "agil" || pace === "dinamico" ? "dinamico" : "natural",
    expressiveness: expressiveness === "suave" || expressiveness === "alta" ? expressiveness : "equilibrada",
  };
}

export function geminiTtsStyle(settings: GeminiTtsSettings): string {
  return [
    GEMINI_TTS_PROFILE.style,
    GEMINI_TTS_PACES[settings.pace].style,
    GEMINI_TTS_EXPRESSIVENESS[settings.expressiveness].style,
    "Narre apenas o texto fornecido, preservando as palavras e a ordem, sem acrescentar comentários.",
  ].join(" ");
}

/**
 * Tamanho das partes da leitura progressiva. O Gemini gera ~19 ms por caractere
 * (medido em 27/11/2026: 300 caracteres em 6,6 s, 1.500 em 28,7 s) e cerca de
 * quatro vezes mais rápido do que fala. A primeira parte é curta para o som
 * sair logo; as seguintes crescem porque já há áudio tocando enquanto chegam.
 */
export const GEMINI_TTS_PART_LIMITS = [320, 800, 1200] as const;
export const GEMINI_TTS_PART_CONCURRENCY = 2;
const MIN_SENTENCE_PART = 40;

/** Fatia texto já saneado em partes, preferindo parágrafo, depois fim de frase. */
export function splitGeminiSpeechText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest) {
    const limit = GEMINI_TTS_PART_LIMITS[Math.min(parts.length, GEMINI_TTS_PART_LIMITS.length - 1)];
    if (rest.length <= limit) {
      parts.push(rest);
      break;
    }
    const head = rest.slice(0, limit + 1);
    const paragraph = head.lastIndexOf("\n");
    let sentence = -1;
    for (const match of head.matchAll(/[.!?…]+["')\]»”]*(?=\s)/g)) sentence = match.index + match[0].length;
    let end = paragraph >= limit / 2 ? paragraph
      : sentence >= MIN_SENTENCE_PART ? sentence
      : paragraph >= MIN_SENTENCE_PART ? paragraph
      : head.lastIndexOf(" ");
    if (end < MIN_SENTENCE_PART) end = /[\uD800-\uDBFF]$/.test(rest.slice(0, limit)) ? limit - 1 : limit;
    parts.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end).trimStart();
  }
  return parts;
}

/**
 * Une os WAVs das partes num arquivo só. A rota sempre devolve o cabeçalho
 * canônico de 44 bytes (PCM 16 bits, mono, 24 kHz), então basta descartar o
 * cabeçalho de cada parte; `Blob.slice` não copia os dados.
 */
export function joinGeminiWavs(parts: Blob[]): Blob {
  const size = parts.reduce((total, part) => total + part.size - 44, 0);
  const header = new DataView(new ArrayBuffer(44));
  const ascii = (offset: number, value: string) => [...value].forEach((char, index) => header.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF");
  header.setUint32(4, 36 + size, true);
  ascii(8, "WAVEfmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, 24_000, true);
  header.setUint32(28, 48_000, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  ascii(36, "data");
  header.setUint32(40, size, true);
  return new Blob([header.buffer, ...parts.map((part) => part.slice(44))], { type: "audio/wav" });
}
