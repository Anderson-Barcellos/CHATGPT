import "server-only";

import OpenAI from "openai";
import type {
  StudioAutocompleteFinishReason,
  StudioAutocompleteRequest,
  StudioAutocompleteResponse,
} from "@/lib/studio/autocomplete";

export const STUDIO_FIM_BASE_URL = "https://api.deepseek.com/beta";
export const STUDIO_FIM_MODEL = "deepseek-v4-pro";

type StudioAutocompleteParseResult =
  | { ok: true; value: StudioAutocompleteRequest }
  | { ok: false; message: string; code: string };

const REQUEST_FIELDS = new Set([
  "filePath",
  "language",
  "prefix",
  "suffix",
]);
const FINISH_REASONS = new Set<StudioAutocompleteFinishReason>([
  "stop",
  "length",
  "content_filter",
  "insufficient_system_resource",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStudioAutocompleteRequest(
  input: unknown
): StudioAutocompleteParseResult {
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => !REQUEST_FIELDS.has(key))
  ) {
    return {
      ok: false,
      message: "Corpo do autocomplete inválido.",
      code: "studio_autocomplete_body_invalid",
    };
  }

  const { filePath, language, prefix, suffix } = input;
  if (
    typeof filePath !== "string" ||
    filePath.trim().length === 0 ||
    filePath.length > 320 ||
    (language !== "typescript" && language !== "javascript") ||
    typeof prefix !== "string" ||
    typeof suffix !== "string" ||
    prefix.length + suffix.length > 32_000
  ) {
    return {
      ok: false,
      message: "Contexto do autocomplete inválido ou grande demais.",
      code: "studio_autocomplete_context_invalid",
    };
  }

  return {
    ok: true,
    value: { filePath, language, prefix, suffix },
  };
}

export function createStudioFimClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return null;

  return new OpenAI({ apiKey, baseURL: STUDIO_FIM_BASE_URL });
}

export function buildStudioFimParams(request: StudioAutocompleteRequest) {
  return {
    model: STUDIO_FIM_MODEL,
    prompt: request.prefix,
    suffix: request.suffix,
    max_tokens: 256,
    temperature: 0.1,
  } satisfies OpenAI.Completions.CompletionCreateParamsNonStreaming;
}

function normalizeFinishReason(
  finishReason: string | null | undefined
): StudioAutocompleteFinishReason {
  return FINISH_REASONS.has(finishReason as StudioAutocompleteFinishReason)
    ? (finishReason as StudioAutocompleteFinishReason)
    : "insufficient_system_resource";
}

export async function requestStudioFimCompletion(
  client: OpenAI,
  request: StudioAutocompleteRequest,
  signal: AbortSignal
): Promise<StudioAutocompleteResponse> {
  const response = await client.completions.create(
    buildStudioFimParams(request),
    { signal }
  );
  const choice = response.choices[0];

  return {
    completion: choice?.text ?? "",
    finishReason: normalizeFinishReason(choice?.finish_reason),
  };
}
