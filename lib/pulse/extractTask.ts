import OpenAI from "openai";
import { PulseTaskProposal, PulseRecurrenceType } from "@/lib/pulse/types";

const DEFAULT_MODEL = "gpt-5.4-mini";

interface RawPulseProposal {
  canCreate?: unknown;
  missingFields?: unknown;
  confidence?: unknown;
  title?: unknown;
  emoji?: unknown;
  prompt?: unknown;
  executionPrompt?: unknown;
  recurrenceType?: unknown;
  time?: unknown;
  weekday?: unknown;
  dayOfMonth?: unknown;
}

export class PulseTaskExtractionError extends Error {
  code: string;
  status: number;
  missingFields: string[];

  constructor(
    message: string,
    code = "pulse_task_extraction_failed",
    status = 422,
    missingFields: string[] = []
  ) {
    super(message);
    this.name = "PulseTaskExtractionError";
    this.code = code;
    this.status = status;
    this.missingFields = missingFields;
  }
}

export const pulseTaskExtractionSchema = {
  type: "json_schema" as const,
  name: "pulse_task_from_text",
  strict: true,
  description:
    "Extrai uma rotina recorrente do Pulse do Gaucho Chat a partir de linguagem natural em portugues.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "canCreate",
      "missingFields",
      "confidence",
      "title",
      "emoji",
      "prompt",
      "executionPrompt",
      "recurrenceType",
      "time",
      "weekday",
      "dayOfMonth",
    ],
    properties: {
      canCreate: { type: "boolean" },
      missingFields: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      title: { type: "string" },
      emoji: { type: "string" },
      prompt: { type: "string" },
      executionPrompt: { type: "string" },
      recurrenceType: { type: "string", enum: ["daily", "weekly", "monthly"] },
      time: { type: "string" },
      weekday: { type: "number" },
      dayOfMonth: { type: "number" },
    },
  },
};

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeMissingFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
}

function normalizeConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "low";
}

function normalizeRecurrence(value: unknown): PulseRecurrenceType {
  if (value === "weekly" || value === "monthly") return value;
  return "daily";
}

function normalizeTime(value: unknown): string {
  const raw = cleanString(value);
  if (raw && /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw)) return raw;
  return "";
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

function parseProposal(rawContent: string): RawPulseProposal {
  try {
    return JSON.parse(rawContent) as RawPulseProposal;
  } catch {
    throw new PulseTaskExtractionError(
      "Nao consegui interpretar essa rotina.",
      "pulse_task_json_invalid",
      502
    );
  }
}

function buildInstructions(now: Date): string {
  return `Tu transformas pedidos recorrentes em rotinas do Pulse do Gaucho Chat.
Data/hora atual: ${now.toISOString()}.
Fuso horario padrao: America/Sao_Paulo.

Regras:
- O Pulse roda tarefas recorrentes automaticamente dentro do Gaucho Chat.
- Aceita frequencias daily, weekly ou monthly.
- time deve sempre ser HH:mm em 24h.
- weekday usa 0=domingo, 1=segunda, ... 6=sabado.
- dayOfMonth fica entre 1 e 31.
- Se faltar frequencia, dia necessario ou horario, canCreate=false e liste missingFields.
- Se o usuario pedir algo semanal sem dia, use missingFields=["dia da semana"].
- Se o usuario pedir algo mensal sem dia, use missingFields=["dia do mes"].
- Crie title curto, emoji unico coerente e executionPrompt completo.
- Preserve a intencao do prompt original; nao execute a tarefa agora.`;
}

export async function extractPulseTaskFromText(
  input: { text?: unknown; now?: unknown },
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
): Promise<PulseTaskProposal> {
  const text = cleanString(input.text);
  if (!text) {
    throw new PulseTaskExtractionError(
      "Texto e obrigatorio para criar uma rotina Pulse.",
      "pulse_task_text_required",
      400
    );
  }

  const nowRaw = cleanString(input.now);
  const now = nowRaw ? new Date(nowRaw) : new Date();
  const response = await client.responses.create({
    model: process.env.PULSE_EXTRACT_MODEL?.trim() || DEFAULT_MODEL,
    instructions: buildInstructions(Number.isNaN(now.getTime()) ? new Date() : now),
    input: [{ role: "user", content: [{ type: "input_text", text }] }],
    max_output_tokens: 1200,
    text: { format: pulseTaskExtractionSchema },
  });

  const extracted = parseProposal(extractOutputText(response));
  const missingFields = normalizeMissingFields(extracted.missingFields);
  const recurrenceType = normalizeRecurrence(extracted.recurrenceType);
  const time = normalizeTime(extracted.time);

  return {
    canCreate: extracted.canCreate === true,
    missingFields,
    confidence: normalizeConfidence(extracted.confidence),
    title: cleanString(extracted.title) ?? "Nova rotina Pulse",
    emoji: cleanString(extracted.emoji) ?? "✨",
    prompt: text,
    executionPrompt: cleanString(extracted.executionPrompt) ?? text,
    recurrenceType,
    time,
    ...(Number.isFinite(Number(extracted.weekday))
      ? { weekday: Number(extracted.weekday) }
      : {}),
    ...(Number.isFinite(Number(extracted.dayOfMonth))
      ? { dayOfMonth: Number(extracted.dayOfMonth) }
      : {}),
  };
}
