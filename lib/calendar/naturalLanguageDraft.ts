import OpenAI from "openai";
import {
  CalendarDraftValidationError,
  CalendarEventDraft,
  CalendarEventDraftInput,
  createCalendarEventDraft,
  defaultCalendarId,
} from "@/lib/calendar/eventDrafts";

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_MODEL = "gpt-5.4-mini";

export type CalendarDraftTextSource = "chat" | "stt";

export interface CalendarDraftFromTextInput {
  text?: unknown;
  source?: unknown;
  conversationId?: unknown;
  sourceMessageId?: unknown;
  now?: unknown;
}

export interface CalendarDraftExtractionResult {
  draft: CalendarEventDraft;
  missingFields: string[];
  confidence: "low" | "medium" | "high";
}

interface ExtractedCalendarDraft {
  canDraft?: unknown;
  missingFields?: unknown;
  confidence?: unknown;
  summary?: unknown;
  description?: unknown;
  location?: unknown;
  startDateTime?: unknown;
  endDateTime?: unknown;
  durationMinutes?: unknown;
}

export class CalendarDraftExtractionError extends Error {
  code: string;
  status: number;
  missingFields: string[];

  constructor(
    message: string,
    code = "calendar_draft_extraction_failed",
    status = 422,
    missingFields: string[] = []
  ) {
    super(message);
    this.name = "CalendarDraftExtractionError";
    this.code = code;
    this.status = status;
    this.missingFields = missingFields;
  }
}

export const calendarDraftExtractionSchema = {
  type: "json_schema" as const,
  name: "calendar_draft_from_text",
  strict: true,
  description:
    "Extrai um rascunho seguro de evento de agenda a partir de linguagem natural em portugues.",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "canDraft",
      "missingFields",
      "confidence",
      "summary",
      "description",
      "location",
      "startDateTime",
      "endDateTime",
      "durationMinutes",
    ],
    properties: {
      canDraft: { type: "boolean" },
      missingFields: {
        type: "array",
        items: { type: "string" },
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string" },
      description: { type: "string" },
      location: { type: "string" },
      startDateTime: { type: "string" },
      endDateTime: { type: "string" },
      durationMinutes: { type: "number" },
    },
  },
};

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseSource(value: unknown): CalendarDraftTextSource {
  return value === "chat" || value === "stt" ? value : "chat";
}

function parseNow(value: unknown): Date {
  const raw = cleanString(value);
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeMissingFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);
}

function normalizeConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "low";
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

function parseExtraction(rawContent: string): ExtractedCalendarDraft {
  try {
    return JSON.parse(rawContent) as ExtractedCalendarDraft;
  } catch {
    throw new CalendarDraftExtractionError(
      "Nao consegui interpretar a agenda nessa frase.",
      "calendar_draft_json_invalid",
      502
    );
  }
}

function buildInstructions(now: Date): string {
  const timeZone =
    process.env.GOOGLE_CALENDAR_DEFAULT_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;

  return `Tu extrai rascunhos de Google Calendar para o Gaucho Chat.
Data/hora atual: ${now.toISOString()}.
Fuso horario padrao: ${timeZone}.

Regras:
- Nunca confirmes nem escrevas no Google Calendar.
- Cria apenas rascunho quando houver titulo/intencao e horario inicial inferivel.
- Interpreta datas relativas em portugues brasileiro usando a data atual.
- Se faltar data, hora ou titulo, canDraft=false e lista missingFields.
- Usa ISO 8601 com offset quando possivel; se o texto nao der duracao, usa 60 minutos.
- Mantem descricao curta com o texto original ou detalhes relevantes.
- Nao inventes convidados, links ou dados externos.`;
}

function buildDraftInput(
  extracted: ExtractedCalendarDraft,
  input: CalendarDraftFromTextInput,
  text: string
): CalendarEventDraftInput {
  const source = parseSource(input.source);
  const summary = cleanString(extracted.summary);
  const startDateTime = cleanString(extracted.startDateTime);
  const endDateTime = cleanString(extracted.endDateTime);
  const timeZone =
    process.env.GOOGLE_CALENDAR_DEFAULT_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;

  if (!summary || !startDateTime) {
    const missingFields = normalizeMissingFields(extracted.missingFields);
    throw new CalendarDraftExtractionError(
      "Faltou titulo, data ou horario para montar um rascunho seguro.",
      "calendar_draft_missing_fields",
      422,
      missingFields.length > 0 ? missingFields : ["titulo", "data", "horario"]
    );
  }

  return {
    action: "create",
    calendarId: defaultCalendarId(),
    summary,
    description:
      cleanString(extracted.description) ||
      `Rascunho criado a partir de: ${text.slice(0, 500)}`,
    ...(cleanString(extracted.location) ? { location: cleanString(extracted.location) } : {}),
    start: { dateTime: startDateTime, timeZone },
    ...(endDateTime ? { end: { dateTime: endDateTime, timeZone } } : {}),
    ...(typeof extracted.durationMinutes === "number"
      ? { durationMinutes: extracted.durationMinutes }
      : {}),
    source,
    ...(cleanString(input.conversationId)
      ? { conversationId: cleanString(input.conversationId) }
      : {}),
    ...(cleanString(input.sourceMessageId)
      ? { sourceMessageId: cleanString(input.sourceMessageId) }
      : {}),
  };
}

export async function createCalendarDraftFromNaturalLanguage(
  input: CalendarDraftFromTextInput,
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
): Promise<CalendarDraftExtractionResult> {
  const text = cleanString(input.text);
  if (!text) {
    throw new CalendarDraftExtractionError(
      "Texto e obrigatorio para rascunhar agenda.",
      "calendar_draft_text_required",
      400
    );
  }

  const now = parseNow(input.now);
  const response = await client.responses.create({
    model: process.env.CALENDAR_DRAFT_MODEL?.trim() || DEFAULT_MODEL,
    instructions: buildInstructions(now),
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text }],
      },
    ],
    max_output_tokens: 900,
    text: { format: calendarDraftExtractionSchema },
  });

  const extracted = parseExtraction(extractOutputText(response));
  const missingFields = normalizeMissingFields(extracted.missingFields);

  if (extracted.canDraft !== true) {
    throw new CalendarDraftExtractionError(
      "Faltam dados para criar um rascunho de agenda confiavel.",
      "calendar_draft_incomplete",
      422,
      missingFields
    );
  }

  try {
    const draft = await createCalendarEventDraft(
      buildDraftInput(extracted, input, text)
    );
    return {
      draft,
      missingFields,
      confidence: normalizeConfidence(extracted.confidence),
    };
  } catch (error) {
    if (error instanceof CalendarDraftValidationError) {
      throw new CalendarDraftExtractionError(error.message, error.code, 422);
    }
    throw error;
  }
}
