import "server-only";

import OpenAI from "openai";
import type {
  StudioAutocompleteFinishReason,
  StudioAutocompleteRequest,
  StudioAutocompleteResponse,
} from "@/lib/studio/autocomplete";

export const STUDIO_FIM_PROVIDERS = {
  codestral: {
    baseURL: "https://codestral.mistral.ai/v1",
    model: "codestral-latest",
    envKey: "CODESTRAL_API_KEY",
  },
  mistral: {
    baseURL: "https://api.mistral.ai/v1",
    model: "codestral-latest",
    envKey: "MISTRAL_API_KEY",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/beta",
    model: "deepseek-v4-pro",
    envKey: "DEEPSEEK_API_KEY",
  },
} as const;

export type StudioFimProvider = keyof typeof STUDIO_FIM_PROVIDERS;

// Ordem de preferência: key dedicada Codestral > La Plateforme > fallback DeepSeek.
const PROVIDER_PRIORITY: readonly StudioFimProvider[] = [
  "codestral",
  "mistral",
  "deepseek",
];

export type StudioFimClient = {
  client: OpenAI;
  provider: StudioFimProvider;
};

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
    (language !== "typescript" &&
      language !== "javascript" &&
      language !== "python") ||
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

export function createStudioFimClient(): StudioFimClient | null {
  for (const provider of PROVIDER_PRIORITY) {
    const apiKey = process.env[STUDIO_FIM_PROVIDERS[provider].envKey]?.trim();
    if (!apiKey) continue;

    return {
      provider,
      client: new OpenAI({
        apiKey,
        baseURL: STUDIO_FIM_PROVIDERS[provider].baseURL,
        maxRetries: 0,
        logLevel: "off",
      }),
    };
  }

  return null;
}

export function buildStudioFimParams(
  provider: StudioFimProvider,
  request: StudioAutocompleteRequest
) {
  return {
    model: STUDIO_FIM_PROVIDERS[provider].model,
    prompt: request.prefix,
    suffix: request.suffix,
    max_tokens: 256,
    temperature: 0.1,
  } satisfies OpenAI.Completions.CompletionCreateParamsNonStreaming;
}

function normalizeFinishReason(
  finishReason: string | null | undefined
): StudioAutocompleteFinishReason {
  // A rota FIM da Mistral usa "model_length" onde o contrato clássico usa "length".
  if (finishReason === "model_length") return "length";
  return FINISH_REASONS.has(finishReason as StudioAutocompleteFinishReason)
    ? (finishReason as StudioAutocompleteFinishReason)
    : "insufficient_system_resource";
}

type MistralFimResponse = {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
};

export async function requestStudioFimCompletion(
  fim: StudioFimClient,
  request: StudioAutocompleteRequest,
  signal: AbortSignal
): Promise<StudioAutocompleteResponse> {
  const params = buildStudioFimParams(fim.provider, request);

  if (fim.provider === "deepseek") {
    const response = await fim.client.completions.create(params, { signal });
    const choice = response.choices[0];

    return {
      completion: choice?.text ?? "",
      finishReason: normalizeFinishReason(choice?.finish_reason),
    };
  }

  // A rota /v1/fim/completions não existe no SDK OpenAI; o post cru preserva
  // APIError (429 etc.) para o tratamento de erros da route.
  const response = (await fim.client.post("/fim/completions", {
    body: params,
    signal,
  })) as MistralFimResponse;
  const choice = response.choices?.[0];

  return {
    completion: choice?.message?.content ?? "",
    finishReason: normalizeFinishReason(choice?.finish_reason),
  };
}
