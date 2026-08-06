# Gaucho Studio FIM Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ghost text automático e aceitável com `Tab` ao Monaco do Gaucho Studio desktop usando DeepSeek FIM, sem permitir aplicação automática pelo chat lateral.

**Architecture:** Um núcleo cliente puro recorta e valida o contexto; um provider nativo do Monaco coordena debounce, cancelamento, obsolescência e cooldown; uma rota Next autenticada chama um adapter OpenAI-compatible exclusivo para o endpoint FIM Beta. A preferência permanece no snapshot local v1, enquanto chat, runner, autosave e autocomplete continuam independentes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Monaco Editor 0.55.1, OpenAI SDK 6.46.0 contra DeepSeek Beta, Vitest 4 e Playwright 1.59.

**Execution constraint:** Neste repositório, executar inline por padrão. Só usar subagentes se Anders autorizar explicitamente essa execução paralela.

---

## File map

| Arquivo | Responsabilidade |
|---|---|
| `lib/studio/autocomplete.ts` | Regras puras de elegibilidade, janela 24k/8k, chave de request, normalização e cooldown |
| `lib/studio/autocompleteProvider.ts` | Registro nativo no Monaco, fetch, abort, timeout, obsolescência, status e encadeamento |
| `lib/server/studioAutocomplete.ts` | Validação estrita do contrato e adapter DeepSeek FIM Beta |
| `app/api/studio/autocomplete/route.ts` | Auth, limite de body, timeout, resposta sanitizada e classificação de erro |
| `components/studio/StudioAutocompleteControl.tsx` | Controle/status acessível do autocomplete no topo |
| `components/studio/StudioEditor.tsx` | Acoplamento mínimo entre editor e provider |
| `components/studio/GauchoStudioShell.tsx` | Preferência persistida e apresentação de estado |
| `lib/studio/types.ts`, `lib/studio/workspace.ts`, `hooks/useStudioWorkspace.ts` | Persistência compatível do toggle no snapshot v1 |
| `lib/security/rateLimit.ts`, `proxy.ts` | Faixa própria de 180 RPM para a nova rota |
| `scripts/smoke-studio-autocomplete.mjs` | Smoke determinístico do Monaco real com upstream interceptado |
| `scripts/smoke-studio-autocomplete-real.mjs` | Smoke curto do contrato FIM real com código sintético |

### Task 1: Persistir a preferência sem migrar a versão do workspace

**Files:**
- Modify: `lib/studio/types.ts`
- Modify: `lib/studio/workspace.ts`
- Modify: `lib/studio/workspace.test.ts`
- Modify: `hooks/useStudioWorkspace.ts`

- [x] **Step 1: Write the failing persistence tests**

Adicionar a `lib/studio/workspace.test.ts`:

```ts
it("enables autocomplete by default in a new workspace", () => {
  expect(createInitialStudioWorkspace().autocompleteEnabled).toBe(true);
});

it("normalizes legacy v1 snapshots without an autocomplete preference to enabled", () => {
  const initial = createInitialStudioWorkspace();
  const { autocompleteEnabled: _removed, ...legacy } = initial;

  expect(parseStudioWorkspace(JSON.stringify(legacy)).autocompleteEnabled).toBe(true);
});

it("restores an explicitly disabled autocomplete preference", () => {
  const initial = createInitialStudioWorkspace();
  const restored = parseStudioWorkspace(
    JSON.stringify({ ...initial, autocompleteEnabled: false })
  );

  expect(restored.version).toBe(1);
  expect(restored.autocompleteEnabled).toBe(false);
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- lib/studio/workspace.test.ts`

Expected: FAIL because `autocompleteEnabled` does not exist on `StudioWorkspaceSnapshot`.

- [x] **Step 3: Add the field, normalization and mutation**

Adicionar a `StudioWorkspaceSnapshot` em `lib/studio/types.ts`:

```ts
autocompleteEnabled: boolean;
```

Adicionar ao retorno de `createInitialStudioWorkspace()` e `parseStudioWorkspace()` em `lib/studio/workspace.ts`:

```ts
autocompleteEnabled: true,
```

```ts
autocompleteEnabled:
  typeof candidate.autocompleteEnabled === "boolean"
    ? candidate.autocompleteEnabled
    : true,
```

Adicionar a `hooks/useStudioWorkspace.ts`:

```ts
const setAutocompleteEnabled = useCallback(
  (enabled: boolean) => {
    mutateWorkspace((current) =>
      current.autocompleteEnabled === enabled
        ? current
        : { ...current, autocompleteEnabled: enabled }
    );
  },
  [mutateWorkspace]
);
```

Expor `setAutocompleteEnabled` no objeto retornado pelo hook.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- lib/studio/workspace.test.ts`

Expected: PASS, incluindo snapshots antigos sem alteração de `version: 1`.

- [x] **Step 5: Commit the persistence slice**

```bash
git add lib/studio/types.ts lib/studio/workspace.ts lib/studio/workspace.test.ts hooks/useStudioWorkspace.ts
git commit -m "feat(studio): persist autocomplete preference"
```

### Task 2: Implementar as regras puras de contexto, resposta e cooldown

**Files:**
- Create: `lib/studio/autocomplete.ts`
- Create: `lib/studio/autocomplete.test.ts`

- [x] **Step 1: Write failing tests for every pure rule**

Criar `lib/studio/autocomplete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  StudioAutocompleteFailureTracker,
  buildStudioAutocompleteContext,
  createStudioAutocompleteRequestKey,
  isStudioAutocompleteEligible,
  normalizeStudioAutocompleteCompletion,
} from "@/lib/studio/autocomplete";

describe("Studio autocomplete rules", () => {
  it("uses the whole script through 32k characters", () => {
    const source = `${"a".repeat(10_000)}CURSOR${"b".repeat(10_000)}`;
    const context = buildStudioAutocompleteContext(source, 10_000);
    expect(context.prefix).toBe("a".repeat(10_000));
    expect(context.suffix).toBe(`CURSOR${"b".repeat(10_000)}`);
  });

  it("caps a large script at 24k before and 8k after the cursor", () => {
    const source = `${"a".repeat(30_000)}${"b".repeat(20_000)}`;
    const context = buildStudioAutocompleteContext(source, 30_000);
    expect(context.prefix).toHaveLength(24_000);
    expect(context.suffix).toHaveLength(8_000);
    expect(context.prefix).toBe("a".repeat(24_000));
    expect(context.suffix).toBe("b".repeat(8_000));
  });

  it.each([
    [{ enabled: false }, false],
    [{ desktop: false }, false],
    [{ focused: false }, false],
    [{ selectionEmpty: false }, false],
    [{ composing: true }, false],
    [{ language: "json" }, false],
    [{ language: "typescript" }, true],
    [{ language: "javascript" }, true],
  ])("evaluates eligibility for %o", (override, expected) => {
    expect(
      isStudioAutocompleteEligible({
        enabled: true,
        desktop: true,
        focused: true,
        selectionEmpty: true,
        composing: false,
        language: "typescript",
        ...override,
      })
    ).toBe(expected);
  });

  it("invalidates a request when URI, version, position or context changes", () => {
    const base = {
      uri: "file:///src/index.ts",
      version: 3,
      lineNumber: 2,
      column: 4,
      prefix: "const a = ",
      suffix: ";",
    };
    const key = createStudioAutocompleteRequestKey(base);
    expect(createStudioAutocompleteRequestKey(base)).toBe(key);
    expect(createStudioAutocompleteRequestKey({ ...base, version: 4 })).not.toBe(key);
    expect(createStudioAutocompleteRequestKey({ ...base, column: 5 })).not.toBe(key);
    expect(createStudioAutocompleteRequestKey({ ...base, prefix: "let a = " })).not.toBe(key);
  });

  it("keeps multiline completions only at line end", () => {
    expect(normalizeStudioAutocompleteCompletion("foo();\nbar();", "stop", true))
      .toBe("foo();\nbar();");
    expect(normalizeStudioAutocompleteCompletion("foo();\nbar();", "stop", false))
      .toBe("foo();");
  });

  it.each(["", "```ts\nfoo();\n```", "```javascript"])(
    "discards empty or fenced output %j",
    (completion) => {
      expect(normalizeStudioAutocompleteCompletion(completion, "stop", true)).toBeNull();
    }
  );

  it.each(["length", "content_filter", "insufficient_system_resource"] as const)(
    "discards non-terminal finish reason %s",
    (finishReason) => {
      expect(normalizeStudioAutocompleteCompletion("foo()", finishReason, true)).toBeNull();
    }
  );

  it("enters cooldown after three failures and resets on success", () => {
    let now = 1_000;
    const tracker = new StudioAutocompleteFailureTracker(() => now);
    tracker.recordFailure();
    tracker.recordFailure();
    expect(tracker.isCoolingDown()).toBe(false);
    tracker.recordFailure();
    expect(tracker.isCoolingDown()).toBe(true);
    now += 30_001;
    expect(tracker.isCoolingDown()).toBe(false);
    tracker.recordSuccess();
    expect(tracker.consecutiveFailures).toBe(0);
  });

  it("respects Retry-After immediately", () => {
    let now = 5_000;
    const tracker = new StudioAutocompleteFailureTracker(() => now);
    tracker.recordFailure(12);
    expect(tracker.cooldownRemainingMs()).toBe(12_000);
    now += 12_001;
    expect(tracker.isCoolingDown()).toBe(false);
  });
});
```

- [x] **Step 2: Run the pure tests and verify RED**

Run: `npm test -- lib/studio/autocomplete.test.ts`

Expected: FAIL because `@/lib/studio/autocomplete` does not exist.

- [x] **Step 3: Implement the pure module**

Criar `lib/studio/autocomplete.ts` com estes contratos e regras:

```ts
export const STUDIO_AUTOCOMPLETE_MAX_CONTEXT = 32_000;
export const STUDIO_AUTOCOMPLETE_PREFIX_LIMIT = 24_000;
export const STUDIO_AUTOCOMPLETE_SUFFIX_LIMIT = 8_000;
export const STUDIO_AUTOCOMPLETE_DEBOUNCE_MS = 450;
export const STUDIO_AUTOCOMPLETE_TIMEOUT_MS = 8_000;
export const STUDIO_AUTOCOMPLETE_COOLDOWN_MS = 30_000;

export type StudioAutocompleteLanguage = "typescript" | "javascript";
export type StudioAutocompleteFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "insufficient_system_resource";
export type StudioAutocompleteStatus = "idle" | "requesting" | "cooldown" | "off";

export interface StudioAutocompleteRequest {
  filePath: string;
  language: StudioAutocompleteLanguage;
  prefix: string;
  suffix: string;
}

export interface StudioAutocompleteResponse {
  completion: string;
  finishReason: StudioAutocompleteFinishReason;
}

export function buildStudioAutocompleteContext(source: string, offset: number) {
  const cursor = Math.max(0, Math.min(offset, source.length));
  const prefix = source.slice(0, cursor);
  const suffix = source.slice(cursor);
  if (source.length <= STUDIO_AUTOCOMPLETE_MAX_CONTEXT) return { prefix, suffix };
  return {
    prefix: prefix.slice(-STUDIO_AUTOCOMPLETE_PREFIX_LIMIT),
    suffix: suffix.slice(0, STUDIO_AUTOCOMPLETE_SUFFIX_LIMIT),
  };
}

function hashContext(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createStudioAutocompleteRequestKey(input: {
  uri: string;
  version: number;
  lineNumber: number;
  column: number;
  prefix: string;
  suffix: string;
}): string {
  return [
    input.uri,
    input.version,
    input.lineNumber,
    input.column,
    hashContext(`${input.prefix}\u0000${input.suffix}`),
  ].join(":");
}

export function isStudioAutocompleteEligible(input: {
  enabled: boolean;
  desktop: boolean;
  focused: boolean;
  selectionEmpty: boolean;
  composing: boolean;
  language: string;
}): boolean {
  return (
    input.enabled &&
    input.desktop &&
    input.focused &&
    input.selectionEmpty &&
    !input.composing &&
    (input.language === "typescript" || input.language === "javascript")
  );
}

export function normalizeStudioAutocompleteCompletion(
  completion: string,
  finishReason: StudioAutocompleteFinishReason,
  atLineEnd: boolean
): string | null {
  if (finishReason !== "stop" || !completion.trim() || completion.includes("```")) {
    return null;
  }
  if (atLineEnd) return completion;
  return completion.split(/\r?\n/).find((line) => line.trim().length > 0) ?? null;
}

export class StudioAutocompleteFailureTracker {
  consecutiveFailures = 0;
  private cooldownUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  recordFailure(retryAfterSeconds?: number) {
    this.consecutiveFailures += 1;
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      this.cooldownUntil = this.now() + retryAfterSeconds * 1_000;
    } else if (this.consecutiveFailures >= 3) {
      this.cooldownUntil = this.now() + STUDIO_AUTOCOMPLETE_COOLDOWN_MS;
    }
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.cooldownUntil = 0;
  }

  cooldownRemainingMs() {
    return Math.max(0, this.cooldownUntil - this.now());
  }

  isCoolingDown() {
    return this.cooldownRemainingMs() > 0;
  }
}
```

- [x] **Step 4: Run the pure tests and verify GREEN**

Run: `npm test -- lib/studio/autocomplete.test.ts`

Expected: PASS for all context, eligibility, stale-key, normalization and cooldown cases.

- [x] **Step 5: Commit the pure client rules**

```bash
git add lib/studio/autocomplete.ts lib/studio/autocomplete.test.ts
git commit -m "feat(studio): add autocomplete context rules"
```

### Task 3: Criar o parser estrito e o adapter DeepSeek FIM

**Files:**
- Create: `lib/server/studioAutocomplete.ts`
- Create: `lib/server/studioAutocomplete.test.ts`

- [x] **Step 1: Write failing server-contract tests**

Criar `lib/server/studioAutocomplete.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildStudioFimParams,
  parseStudioAutocompleteRequest,
  requestStudioFimCompletion,
  STUDIO_FIM_BASE_URL,
} from "@/lib/server/studioAutocomplete";

const valid = {
  filePath: "src/index.ts",
  language: "typescript",
  prefix: "const total = ",
  suffix: ";",
};

describe("Studio autocomplete server contract", () => {
  it("accepts only the exact browser contract", () => {
    expect(parseStudioAutocompleteRequest(valid)).toMatchObject({ ok: true });
    expect(parseStudioAutocompleteRequest({ ...valid, extra: true })).toMatchObject({
      ok: false,
      code: "studio_autocomplete_body_invalid",
    });
  });

  it.each([
    { ...valid, filePath: "x".repeat(321) },
    { ...valid, language: "python" },
    { ...valid, prefix: "x".repeat(32_001) },
    { ...valid, prefix: "x".repeat(24_001), suffix: "y".repeat(8_000) },
  ])("rejects invalid input %#", (body) => {
    expect(parseStudioAutocompleteRequest(body)).toMatchObject({ ok: false });
  });

  it("builds a non-reasoning FIM request for the Beta API", () => {
    expect(STUDIO_FIM_BASE_URL).toBe("https://api.deepseek.com/beta");
    expect(buildStudioFimParams(valid)).toEqual({
      model: "deepseek-v4-pro",
      prompt: valid.prefix,
      suffix: valid.suffix,
      max_tokens: 256,
      temperature: 0.1,
    });
  });

  it("returns only completion and finish reason", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ text: "42", finish_reason: "stop" }],
      usage: { prompt_tokens: 20, completion_tokens: 1 },
    });
    const client = { completions: { create } };

    await expect(
      requestStudioFimCompletion(client as never, valid, new AbortController().signal)
    ).resolves.toEqual({ completion: "42", finishReason: "stop" });
    expect(create).toHaveBeenCalledWith(buildStudioFimParams(valid), {
      signal: expect.any(AbortSignal),
    });
  });
});
```

- [x] **Step 2: Run the server-contract tests and verify RED**

Run: `npm test -- lib/server/studioAutocomplete.test.ts`

Expected: FAIL because the server module does not exist.

- [x] **Step 3: Implement strict parsing and the dedicated client**

Criar `lib/server/studioAutocomplete.ts`:

```ts
import "server-only";

import OpenAI from "openai";
import type {
  StudioAutocompleteFinishReason,
  StudioAutocompleteRequest,
  StudioAutocompleteResponse,
} from "@/lib/studio/autocomplete";

export const STUDIO_FIM_BASE_URL = "https://api.deepseek.com/beta";
export const STUDIO_FIM_MODEL = "deepseek-v4-pro";

type ParseResult =
  | { ok: true; value: StudioAutocompleteRequest }
  | { ok: false; message: string; code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStudioAutocompleteRequest(input: unknown): ParseResult {
  if (!isRecord(input) || Object.keys(input).some(
    (key) => !["filePath", "language", "prefix", "suffix"].includes(key)
  )) {
    return {
      ok: false,
      message: "Corpo do autocomplete inválido.",
      code: "studio_autocomplete_body_invalid",
    };
  }

  const { filePath, language, prefix, suffix } = input;
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
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

  return { ok: true, value: { filePath, language, prefix, suffix } };
}

export function createStudioFimClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey, baseURL: STUDIO_FIM_BASE_URL }) : null;
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

export async function requestStudioFimCompletion(
  client: OpenAI,
  request: StudioAutocompleteRequest,
  signal: AbortSignal
): Promise<StudioAutocompleteResponse> {
  const response = await client.completions.create(buildStudioFimParams(request), {
    signal,
  });
  const choice = response.choices[0];
  const finishReason = choice?.finish_reason;
  return {
    completion: choice?.text ?? "",
    finishReason: ["stop", "length", "content_filter", "insufficient_system_resource"]
      .includes(String(finishReason))
        ? finishReason as StudioAutocompleteFinishReason
        : "insufficient_system_resource",
  };
}
```

- [x] **Step 4: Run the adapter tests and TypeScript**

Run: `npm test -- lib/server/studioAutocomplete.test.ts && npx tsc --noEmit`

Expected: PASS with the exported browser union unchanged and unknown upstream terminal reasons normalized safely.

- [x] **Step 5: Commit the server adapter**

```bash
git add lib/server/studioAutocomplete.ts lib/server/studioAutocomplete.test.ts
git commit -m "feat(studio): add DeepSeek FIM adapter"
```

### Task 4: Expor a rota autenticada com rate limit próprio e erros sanitizados

**Files:**
- Create: `app/api/studio/autocomplete/route.ts`
- Create: `app/api/studio/autocomplete/route.test.ts`
- Modify: `lib/security/rateLimit.ts`
- Modify: `lib/security/rateLimit.test.ts`
- Modify: `proxy.ts`
- Modify: `proxy.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing route and rate-limit tests**

Criar `app/api/studio/autocomplete/route.test.ts` com mocks hoisted para auth e adapter:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authEnabled: vi.fn(() => false),
  authenticated: vi.fn().mockResolvedValue(true),
  createClient: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: mocks.authEnabled,
  isAuthenticatedRequest: mocks.authenticated,
}));
vi.mock("@/lib/server/studioAutocomplete", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server/studioAutocomplete")>();
  return {
    ...original,
    createStudioFimClient: mocks.createClient,
    requestStudioFimCompletion: mocks.complete,
  };
});

import { POST } from "@/app/api/studio/autocomplete/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/chat/api/studio/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const valid = {
  filePath: "src/index.ts",
  language: "typescript",
  prefix: "const answer = ",
  suffix: ";",
};

describe("Studio autocomplete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authEnabled.mockReturnValue(false);
    mocks.createClient.mockReturnValue({});
    mocks.complete.mockResolvedValue({ completion: "42", finishReason: "stop" });
  });

  it("requires app authentication", async () => {
    mocks.authEnabled.mockReturnValue(true);
    mocks.authenticated.mockResolvedValueOnce(false);
    expect((await POST(request(valid))).status).toBe(401);
  });

  it("returns a provider-specific 503 without exposing configuration", async () => {
    mocks.createClient.mockReturnValue(null);
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Autocomplete unavailable",
      message: "Autocomplete temporariamente indisponível.",
      code: "studio_autocomplete_unavailable",
    });
  });

  it("returns only the public completion contract", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ completion: "42", finishReason: "stop" });
  });

  it("maps a request abort to 499", async () => {
    const aborted = request(valid);
    const error = new Error("aborted");
    error.name = "AbortError";
    mocks.complete.mockRejectedValueOnce(error);
    expect((await POST(aborted)).status).toBe(499);
  });

  it("maps the linked upstream timeout to a sanitized 504", async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    mocks.complete.mockRejectedValueOnce(error);
    const response = await POST(request(valid));
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      code: "studio_autocomplete_timeout",
    });
  });

  it("does not return upstream messages", async () => {
    mocks.complete.mockRejectedValueOnce(new Error("sensitive upstream payload"));
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive");
  });
});
```

Adicionar aos testes existentes:

```ts
expect(getRateLimitConfig("/api/studio/autocomplete")).toMatchObject({
  windowMs: 60_000,
  max: 180,
});
expect(shouldRateLimitPath("/api/studio/autocomplete")).toBe(true);
```

- [ ] **Step 2: Run the route/rate tests and verify RED**

Run: `npm test -- app/api/studio/autocomplete/route.test.ts lib/security/rateLimit.test.ts proxy.test.ts`

Expected: FAIL because the route and dedicated 180 RPM configuration do not exist.

- [ ] **Step 3: Implement the dedicated rate-limit mapping**

Adicionar a `RATE_LIMITS` em `lib/security/rateLimit.ts`:

```ts
studioAutocomplete: {
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM || "180", 10),
},
```

Antes da normalização genérica em `getRateLimitConfig`:

```ts
if (endpoint === "/api/studio/autocomplete") {
  return RATE_LIMITS.studioAutocomplete;
}
```

Adicionar `"/api/studio/autocomplete"` a `RATE_LIMITED_PATHS` em `proxy.ts`, sem remover `/api/studio/assist`.

Adicionar a `.env.example`:

```text
RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM=180
```

- [ ] **Step 4: Implement the route with linked timeout**

Criar `app/api/studio/autocomplete/route.ts`:

```ts
import OpenAI from "openai";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import {
  createStudioFimClient,
  parseStudioAutocompleteRequest,
  requestStudioFimCompletion,
} from "@/lib/server/studioAutocomplete";

const BODY_LIMIT_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 8_000;

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return jsonError(401, "Unauthorized", {
        message: "Faça login para continuar.",
        code: "unauthorized",
      });
    }

    const body = await readJsonWithLimit<unknown>(request, {
      limitBytes: BODY_LIMIT_BYTES,
    });
    if (!body.ok) {
      return jsonError(body.status, "Request body error", {
        message: "Corpo do autocomplete inválido.",
        code: "studio_autocomplete_body_invalid",
      });
    }

    const parsed = parseStudioAutocompleteRequest(body.value);
    if (!parsed.ok) {
      return jsonError(400, "Autocomplete request invalid", {
        message: parsed.message,
        code: parsed.code,
      });
    }

    const client = createStudioFimClient();
    if (!client) {
      return jsonError(503, "Autocomplete unavailable", {
        message: "Autocomplete temporariamente indisponível.",
        code: "studio_autocomplete_unavailable",
      });
    }

    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    ]);
    return Response.json(
      await requestStudioFimCompletion(client, parsed.value, signal)
    );
  } catch (error) {
    if (request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return new Response(null, { status: 499 });
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      return jsonError(504, "Autocomplete timeout", {
        message: "Autocomplete temporariamente indisponível.",
        code: "studio_autocomplete_timeout",
      });
    }

    if (error instanceof OpenAI.APIError && error.status === 429) {
      const retryAfter = error.headers?.get("retry-after") ?? "30";
      return Response.json(
        { error: "Too Many Requests", code: "studio_autocomplete_rate_limited" },
        { status: 429, headers: { "Retry-After": retryAfter } }
      );
    }

    console.error("Studio autocomplete upstream failure", {
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(502, "Autocomplete upstream error", {
      message: "Autocomplete temporariamente indisponível.",
      code: "studio_autocomplete_upstream_error",
    });
  }
}
```

- [ ] **Step 5: Run route/rate tests and verify GREEN**

Run: `npm test -- app/api/studio/autocomplete/route.test.ts lib/security/rateLimit.test.ts proxy.test.ts`

Expected: PASS, with auth, 180 RPM, abort and sanitized failures covered.

- [ ] **Step 6: Commit the API slice**

```bash
git add app/api/studio/autocomplete/route.ts app/api/studio/autocomplete/route.test.ts lib/security/rateLimit.ts lib/security/rateLimit.test.ts proxy.ts proxy.test.ts .env.example
git commit -m "feat(studio): expose protected FIM autocomplete route"
```

### Task 5: Registrar o provider Monaco com cancelamento e obsolescência

**Files:**
- Create: `lib/studio/autocompleteProvider.ts`
- Create: `lib/studio/autocompleteProvider.test.ts`

- [ ] **Step 1: Write failing provider tests with Monaco fakes**

Criar `lib/studio/autocompleteProvider.test.ts` cobrindo o contrato público do controller:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStudioAutocompleteRequestController } from "@/lib/studio/autocompleteProvider";

afterEach(() => vi.restoreAllMocks());

const input = {
  key: "file:///src/index.ts:1:1:1:hash",
  request: {
    filePath: "src/index.ts",
    language: "typescript" as const,
    prefix: "const answer = ",
    suffix: ";",
  },
};

describe("Studio autocomplete request controller", () => {
  it("aborts the previous request and never returns its late result", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    const statuses: string[] = [];
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange: (status) => statuses.push(status),
    });

    const first = controller.request(input);
    const second = controller.request({ ...input, key: "new-key" });
    resolvers[0]?.(Response.json({ completion: "old", finishReason: "stop" }));
    resolvers[1]?.(Response.json({ completion: "new", finishReason: "stop" }));

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual({ completion: "new", finishReason: "stop" });
    expect(statuses).toContain("requesting");
  });

  it("times out without surfacing an error", async () => {
    vi.useFakeTimers();
    const controller = createStudioAutocompleteRequestController({
      fetchImpl: vi.fn((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
        );
      })),
    });
    const result = controller.request(input);
    await vi.advanceTimersByTimeAsync(8_001);
    await expect(result).resolves.toBeNull();
    vi.useRealTimers();
  });

  it("honors Retry-After and enters cooldown after three failures", async () => {
    const onStatusChange = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange,
    });
    await controller.request(input);
    await controller.request({ ...input, key: "2" });
    await controller.request({ ...input, key: "3" });
    expect(onStatusChange).toHaveBeenLastCalledWith("cooldown");
  });
});
```

Adicionar ao mesmo arquivo um harness mínimo do Monaco e os testes do provider:

```ts
import { registerStudioAutocompleteProvider } from "@/lib/studio/autocompleteProvider";

function disposable() {
  return { dispose: vi.fn() };
}

function createMonacoHarness() {
  let registeredLanguages: unknown;
  let registeredProvider: any;
  let version = 1;
  let value = "const answer = ";
  let language = "typescript";
  let position = { lineNumber: 1, column: 16 };
  let selectionEmpty = true;
  const eventHandlers = new Map<string, () => void>();
  class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  }
  const model = {
    uri: { toString: () => "file:///src/index.ts" },
    getVersionId: () => version,
    getLanguageId: () => language,
    getValue: () => value,
    getOffsetAt: () => value.length,
    getLineContent: () => value,
  };
  const editor = {
    getSelection: () => ({ isEmpty: () => selectionEmpty }),
    hasTextFocus: () => true,
    getPosition: () => position,
    addCommand: () => "studio.autocomplete.accepted",
    trigger: vi.fn(),
    onDidChangeModelContent: (handler: () => void) => {
      eventHandlers.set("content", handler);
      return disposable();
    },
    onDidChangeCursorPosition: (handler: () => void) => {
      eventHandlers.set("cursor", handler);
      return disposable();
    },
    onDidChangeCursorSelection: (handler: () => void) => {
      eventHandlers.set("selection", handler);
      return disposable();
    },
    onDidChangeModel: (handler: () => void) => {
      eventHandlers.set("model", handler);
      return disposable();
    },
    onDidCompositionStart: (handler: () => void) => {
      eventHandlers.set("compositionStart", handler);
      return disposable();
    },
    onDidCompositionEnd: (handler: () => void) => {
      eventHandlers.set("compositionEnd", handler);
      return disposable();
    },
  };
  const monaco = {
    Range,
    languages: {
      registerInlineCompletionsProvider(languages: unknown, provider: unknown) {
        registeredLanguages = languages;
        registeredProvider = provider;
        return disposable();
      },
    },
  };
  return {
    monaco,
    editor,
    model,
    eventHandlers,
    get registeredLanguages() { return registeredLanguages; },
    get registeredProvider() { return registeredProvider; },
    setVersion(next: number) { version = next; },
    setLanguage(next: string) { language = next; },
    setSelectionEmpty(next: boolean) { selectionEmpty = next; },
    setPosition(next: { lineNumber: number; column: number }) { position = next; },
    setValue(next: string) { value = next; },
  };
}

const token = {
  onCancellationRequested: () => disposable(),
};

it("registers native 450ms inline completions with a zero-width range", async () => {
  const harness = createMonacoHarness();
  const handle = registerStudioAutocompleteProvider({
    monaco: harness.monaco as never,
    editor: harness.editor as never,
    isEnabled: () => true,
    isDesktop: () => true,
    getFilePath: () => "src/index.ts",
    fetchImpl: vi.fn().mockResolvedValue(
      Response.json({ completion: "42", finishReason: "stop" })
    ),
  });
  expect(harness.registeredLanguages).toEqual(["typescript", "javascript"]);
  expect(harness.registeredProvider.debounceDelayMs).toBe(450);
  const result = await harness.registeredProvider.provideInlineCompletions(
    harness.model,
    { lineNumber: 1, column: 16 },
    {},
    token
  );
  expect(result.items[0]).toMatchObject({
    insertText: "42",
    range: { startLineNumber: 1, startColumn: 16, endLineNumber: 1, endColumn: 16 },
  });
  handle.dispose();
});

it("suppresses stale and ineligible results", async () => {
  const harness = createMonacoHarness();
  let resolveFetch!: (response: Response) => void;
  const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
    resolveFetch = resolve;
  }));
  const handle = registerStudioAutocompleteProvider({
    monaco: harness.monaco as never,
    editor: harness.editor as never,
    isEnabled: () => true,
    isDesktop: () => true,
    getFilePath: () => "src/index.ts",
    fetchImpl,
  });
  const pending = harness.registeredProvider.provideInlineCompletions(
    harness.model,
    { lineNumber: 1, column: 16 },
    {},
    token
  );
  harness.setVersion(2);
  resolveFetch(Response.json({ completion: "old", finishReason: "stop" }));
  await expect(pending).resolves.toEqual({ items: [] });

  harness.setLanguage("json");
  await expect(harness.registeredProvider.provideInlineCompletions(
    harness.model,
    { lineNumber: 1, column: 16 },
    {},
    token
  )).resolves.toEqual({ items: [] });
  harness.setLanguage("typescript");
  harness.setSelectionEmpty(false);
  await expect(harness.registeredProvider.provideInlineCompletions(
    harness.model,
    { lineNumber: 1, column: 16 },
    {},
    token
  )).resolves.toEqual({ items: [] });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  handle.dispose();
});
```

Adicionar o caso de composição e desktop:

```ts
it("does not request during IME composition or outside desktop", async () => {
  for (const mode of ["composition", "mobile"] as const) {
    const harness = createMonacoHarness();
    const fetchImpl = vi.fn();
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => mode !== "mobile",
      getFilePath: () => "src/index.ts",
      fetchImpl,
    });
    if (mode === "composition") {
      harness.eventHandlers.get("compositionStart")?.();
    }
    await expect(harness.registeredProvider.provideInlineCompletions(
      harness.model,
      { lineNumber: 1, column: 16 },
      {},
      token
    )).resolves.toEqual({ items: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    handle.dispose();
  }
});
```

- [ ] **Step 2: Run provider tests and verify RED**

Run: `npm test -- lib/studio/autocompleteProvider.test.ts`

Expected: FAIL because the provider/controller module does not exist.

- [ ] **Step 3: Implement the request controller**

Em `lib/studio/autocompleteProvider.ts`, exportar:

```ts
export function createStudioAutocompleteRequestController(options: {
  fetchImpl?: typeof fetch;
  onStatusChange?: (status: StudioAutocompleteStatus) => void;
  onCooldownExpired?: () => void;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const failures = new StudioAutocompleteFailureTracker();
  let active: { key: string; controller: AbortController } | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: StudioAutocompleteStatus) =>
    options.onStatusChange?.(status);

  const reportCooldown = () => {
    setStatus("cooldown");
    if (cooldownTimer) globalThis.clearTimeout(cooldownTimer);
    cooldownTimer = globalThis.setTimeout(() => {
      cooldownTimer = null;
      if (!active) setStatus("idle");
      options.onCooldownExpired?.();
    }, failures.cooldownRemainingMs());
  };

  return {
    cancel(nextStatus: StudioAutocompleteStatus = "idle") {
      active?.controller.abort();
      active = null;
      setStatus(nextStatus);
    },
    async request(input: {
      key: string;
      request: StudioAutocompleteRequest;
    }): Promise<StudioAutocompleteResponse | null> {
      if (failures.isCoolingDown()) {
        reportCooldown();
        return null;
      }

      active?.controller.abort();
      const controller = new AbortController();
      active = { key: input.key, controller };
      let timedOut = false;
      const timeout = globalThis.setTimeout(
        () => {
          timedOut = true;
          controller.abort();
        },
        STUDIO_AUTOCOMPLETE_TIMEOUT_MS
      );
      setStatus("requesting");

      try {
        const response = await fetchImpl(apiUrl("/api/studio/autocomplete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.request),
          signal: controller.signal,
        });
        if (active?.key !== input.key || controller.signal.aborted) return null;
        if (!response.ok) {
          failures.recordFailure(
            response.status === 429
              ? Number.parseInt(response.headers.get("Retry-After") ?? "30", 10)
              : undefined
          );
          if (failures.isCoolingDown()) reportCooldown();
          else setStatus("idle");
          return null;
        }
        const payload = await response.json() as Partial<StudioAutocompleteResponse>;
        if (
          typeof payload.completion !== "string" ||
          !["stop", "length", "content_filter", "insufficient_system_resource"]
            .includes(String(payload.finishReason))
        ) {
          failures.recordFailure();
          if (failures.isCoolingDown()) reportCooldown();
          else setStatus("idle");
          return null;
        }
        failures.recordSuccess();
        setStatus("idle");
        return payload as StudioAutocompleteResponse;
      } catch (error) {
        if (active?.key !== input.key) return null;
        if (timedOut || !(error instanceof Error && error.name === "AbortError")) {
          failures.recordFailure();
        }
        if (failures.isCoolingDown()) reportCooldown();
        else setStatus("idle");
        return null;
      } finally {
        globalThis.clearTimeout(timeout);
        if (active?.key === input.key) active = null;
      }
    },
    dispose() {
      if (cooldownTimer) globalThis.clearTimeout(cooldownTimer);
      cooldownTimer = null;
      active?.controller.abort();
      active = null;
    },
  };
}
```

Importar `apiUrl` de `@/lib/utils` e os contratos/constantes de `@/lib/studio/autocomplete`.

- [ ] **Step 4: Implement the Monaco registration**

No mesmo arquivo, exportar `registerStudioAutocompleteProvider(options)` recebendo `monaco`, `editor`, getters de `enabled`, `desktop`, `filePath`, callback de status e `fetchImpl` opcional. O provider deve:

```ts
const registration = monaco.languages.registerInlineCompletionsProvider(
  ["typescript", "javascript"],
  {
    debounceDelayMs: STUDIO_AUTOCOMPLETE_DEBOUNCE_MS,
    async provideInlineCompletions(model, position, _context, token) {
      const selection = editor.getSelection();
      if (!isStudioAutocompleteEligible({
        enabled: options.isEnabled(),
        desktop: options.isDesktop(),
        focused: editor.hasTextFocus(),
        selectionEmpty: Boolean(selection?.isEmpty()),
        composing,
        language: model.getLanguageId(),
      })) return { items: [] };

      const offset = model.getOffsetAt(position);
      const context = buildStudioAutocompleteContext(model.getValue(), offset);
      const keyInput = {
        uri: model.uri.toString(),
        version: model.getVersionId(),
        lineNumber: position.lineNumber,
        column: position.column,
        ...context,
      };
      const key = createStudioAutocompleteRequestKey(keyInput);
      const cancellation = token.onCancellationRequested(() => requests.cancel());
      const payload = await requests.request({
        key,
        request: {
          filePath: options.getFilePath(),
          language: model.getLanguageId() as StudioAutocompleteLanguage,
          ...context,
        },
      });
      cancellation.dispose();
      if (!payload) return { items: [] };

      const currentPosition = editor.getPosition();
      const currentContext = currentPosition
        ? buildStudioAutocompleteContext(model.getValue(), model.getOffsetAt(currentPosition))
        : null;
      if (!currentPosition || !currentContext || createStudioAutocompleteRequestKey({
        uri: model.uri.toString(),
        version: model.getVersionId(),
        lineNumber: currentPosition.lineNumber,
        column: currentPosition.column,
        ...currentContext,
      }) !== key) return { items: [] };

      const line = model.getLineContent(position.lineNumber);
      const completion = normalizeStudioAutocompleteCompletion(
        payload.completion,
        payload.finishReason,
        position.column === line.length + 1
      );
      if (!completion) return { items: [] };

      return {
        items: [{
          insertText: completion,
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          ...(acceptCommandId
            ? { command: { id: acceptCommandId, title: "Continuar autocomplete" } }
            : {}),
        }],
      };
    },
    disposeInlineCompletions() {},
  }
);
```

Completar o registro com lifecycle explícito:

```ts
let composing = false;
let chainTimer: ReturnType<typeof setTimeout> | null = null;
const trigger = () =>
  editor.trigger("studio.autocomplete", "editor.action.inlineSuggest.trigger", null);
const requests = createStudioAutocompleteRequestController({
  fetchImpl: options.fetchImpl,
  onStatusChange: options.onStatusChange,
  onCooldownExpired: () => {
    if (options.isEnabled() && options.isDesktop()) trigger();
  },
});
const acceptCommandId = editor.addCommand(0, () => {
  if (chainTimer) globalThis.clearTimeout(chainTimer);
  chainTimer = globalThis.setTimeout(trigger, STUDIO_AUTOCOMPLETE_DEBOUNCE_MS);
});
const cancel = () => requests.cancel(options.isEnabled() ? "idle" : "off");
const disposables = [
  editor.onDidChangeModelContent(cancel),
  editor.onDidChangeCursorPosition(cancel),
  editor.onDidChangeCursorSelection(cancel),
  editor.onDidChangeModel(cancel),
  editor.onDidCompositionStart(() => {
    composing = true;
    cancel();
  }),
  editor.onDidCompositionEnd(() => {
    composing = false;
  }),
];

return {
  setEnabled(enabled: boolean) {
    if (!enabled) {
      requests.cancel("off");
      editor.trigger("studio.autocomplete", "editor.action.inlineSuggest.hide", null);
    } else if (options.isDesktop()) {
      options.onStatusChange?.("idle");
      trigger();
    }
  },
  dispose() {
    if (chainTimer) globalThis.clearTimeout(chainTimer);
    requests.dispose();
    for (const disposable of disposables) disposable.dispose();
    registration.dispose();
  },
};
```

- [ ] **Step 5: Run provider tests and TypeScript**

Run: `npm test -- lib/studio/autocompleteProvider.test.ts && npx tsc --noEmit`

Expected: PASS for abort, timeout, cooldown, stale response, eligibility, range and 450 ms registration.

- [ ] **Step 6: Commit the provider**

```bash
git add lib/studio/autocompleteProvider.ts lib/studio/autocompleteProvider.test.ts
git commit -m "feat(studio): register Monaco FIM provider"
```

### Task 6: Integrar provider, toggle e status no Studio

**Files:**
- Create: `components/studio/StudioAutocompleteControl.tsx`
- Create: `components/studio/StudioAutocompleteControl.test.tsx`
- Modify: `components/studio/StudioEditor.tsx`
- Modify: `components/studio/GauchoStudioShell.tsx`
- Modify: `components/studio/GauchoStudioShell.module.css`

- [ ] **Step 1: Write the failing accessible-control test**

Criar `components/studio/StudioAutocompleteControl.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudioAutocompleteControl } from "@/components/studio/StudioAutocompleteControl";

describe("StudioAutocompleteControl", () => {
  it.each([
    ["idle", "Autocomplete ligado"],
    ["requesting", "Autocomplete consultando"],
    ["cooldown", "Autocomplete em espera"],
    ["off", "Autocomplete desligado"],
  ] as const)("renders %s accessibly", (status, label) => {
    const markup = renderToStaticMarkup(
      <StudioAutocompleteControl
        enabled={status !== "off"}
        status={status}
        onToggle={vi.fn()}
      />
    );
    expect(markup).toContain(label);
    expect(markup).toContain('type="button"');
    expect(markup).toContain(`aria-pressed="${status !== "off"}"`);
  });
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- components/studio/StudioAutocompleteControl.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the status control**

Criar `components/studio/StudioAutocompleteControl.tsx`:

```tsx
import type { StudioAutocompleteStatus } from "@/lib/studio/autocomplete";
import { cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

const labels: Record<StudioAutocompleteStatus, string> = {
  idle: "Autocomplete ligado",
  requesting: "Autocomplete consultando",
  cooldown: "Autocomplete em espera",
  off: "Autocomplete desligado",
};

export function StudioAutocompleteControl({
  enabled,
  status,
  onToggle,
}: {
  enabled: boolean;
  status: StudioAutocompleteStatus;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={styles.autocompleteControl}
      aria-label={labels[status]}
      aria-pressed={enabled}
      title={labels[status]}
      onClick={() => onToggle(!enabled)}
    >
      <span
        className={cn(
          styles.autocompleteDot,
          status === "requesting" && styles.autocompleteDotRequesting,
          status === "cooldown" && styles.autocompleteDotCooldown,
          status === "off" && styles.autocompleteDotOff
        )}
      />
      <span>Autocomplete</span>
    </button>
  );
}
```

- [ ] **Step 4: Wire the provider into `StudioEditor`**

Adicionar props:

```ts
autocompleteEnabled: boolean;
onAutocompleteStatusChange?: (status: StudioAutocompleteStatus) => void;
```

Manter refs atualizadas para `file.path`, `autocompleteEnabled` e callback. Em `handleMount`, registrar uma única vez:

```ts
autocompleteRef.current = registerStudioAutocompleteProvider({
  monaco,
  editor: instance,
  isEnabled: () => autocompleteEnabledRef.current,
  isDesktop: () => window.matchMedia("(min-width: 861px) and (pointer: fine)").matches,
  getFilePath: () => filePathRef.current,
  onStatusChange: (status) => onAutocompleteStatusChangeRef.current?.(status),
});
```

Ao mudar `autocompleteEnabled`, chamar `autocompleteRef.current?.setEnabled(enabled)` para abortar e limpar imediatamente quando desligado. No cleanup do componente, chamar `dispose()` e `onReadyChange?.(false)`.

- [ ] **Step 5: Wire persistence and status into the shell**

Em `GauchoStudioShell.tsx`, obter `setAutocompleteEnabled` do hook, criar:

```ts
const [autocompleteStatus, setAutocompleteStatus] =
  useState<StudioAutocompleteStatus>(
    workspace.autocompleteEnabled ? "idle" : "off"
  );
```

Renderizar o controle dentro de `.executionStatus`, depois de “Salvo”, e passar ao editor:

```tsx
<StudioAutocompleteControl
  enabled={workspace.autocompleteEnabled}
  status={workspace.autocompleteEnabled ? autocompleteStatus : "off"}
  onToggle={setAutocompleteEnabled}
/>
```

```tsx
<StudioEditor
  ref={editorRef}
  file={activeFile}
  autocompleteEnabled={workspace.autocompleteEnabled}
  onAutocompleteStatusChange={setAutocompleteStatus}
  onChange={updateActiveFile}
  onReadyChange={setEditorReady}
/>
```

- [ ] **Step 6: Add desktop-only visual states**

Adicionar ao CSS module:

```css
.autocompleteControl {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  border-radius: 999px;
  padding: 0.25rem 0.48rem;
  color: var(--studio-muted);
  font: inherit;
}

.autocompleteControl:hover {
  background: color-mix(in srgb, var(--studio-panel-strong) 72%, transparent);
  color: var(--studio-text);
}

.autocompleteDot {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 999px;
  background: #54b7dc;
}

.autocompleteDotRequesting {
  animation: studioPulse 1s ease-in-out infinite;
  box-shadow: 0 0 0.65rem rgba(84, 183, 220, 0.65);
}

.autocompleteDotCooldown { background: #d9a14b; }
.autocompleteDotOff { background: var(--studio-faint); }

@media (max-width: 860px), (pointer: coarse) {
  .autocompleteControl { display: none; }
}
```

- [ ] **Step 7: Run focused UI/integration tests and TypeScript**

Run: `npm test -- components/studio/StudioAutocompleteControl.test.tsx lib/studio/workspace.test.ts lib/studio/autocompleteProvider.test.ts && npx tsc --noEmit`

Expected: PASS with no change to `StudioAssistantPanel` or runner behavior.

- [ ] **Step 8: Commit the integrated UI**

```bash
git add components/studio/StudioAutocompleteControl.tsx components/studio/StudioAutocompleteControl.test.tsx components/studio/StudioEditor.tsx components/studio/GauchoStudioShell.tsx components/studio/GauchoStudioShell.module.css
git commit -m "feat(studio): show desktop FIM autocomplete"
```

### Task 7: Provar o Monaco real e documentar o contrato

**Files:**
- Create: `scripts/smoke-studio-autocomplete.mjs`
- Create: `scripts/smoke-studio-autocomplete-real.mjs`
- Modify: `scripts/README.md`
- Modify: `README.md`
- Modify: `docs/API.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/INFRASTRUCTURE.md`
- Modify: `/etc/apache2/APACHE.md`

- [ ] **Step 1: Add a deterministic browser smoke**

Criar `scripts/smoke-studio-autocomplete.mjs` usando `playwright` e sem gravar dados server-side. O script deve:

```js
import { chromium } from "playwright";

const baseUrl = process.env.STUDIO_SMOKE_BASE_URL ?? "http://127.0.0.1:3040/chat";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  const requests = [];

  await page.route("**/chat/api/studio/autocomplete", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const prefix = body.prefix ?? "";
    const completion = prefix.endsWith("const answer = ")
      ? "42"
      : prefix.endsWith("const escape = ")
        ? "99"
        : prefix.endsWith("const typed = ")
          ? "77"
          : prefix.endsWith("const moved = ")
            ? "66"
            : prefix.endsWith("const switched = ")
              ? "55"
              : "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ completion, finishReason: "stop" }),
    });
  });

  await page.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    const username = process.env.STUDIO_SMOKE_USERNAME;
    const password = process.env.STUDIO_SMOKE_PASSWORD;
    if (!username || !password) throw new Error("Smoke credentials are required");
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/chat\/?$/);
    await page.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
  }

  const editor = page.locator(".monaco-editor");
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("const answer = ");
  await page.waitForTimeout(650);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const value = await page.evaluate(() => navigator.clipboard.readText());
  if (value !== "const answer = 42") throw new Error(`Unexpected editor value: ${value}`);
  await page.keyboard.press("Control+Z");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const afterUndo = await page.evaluate(() => navigator.clipboard.readText());
  if (afterUndo !== "const answer = ") throw new Error("Undo did not remove one completion");
  await page.waitForTimeout(650);
  if (requests.length < 2) throw new Error("Accepted completion did not chain a request");

  await page.keyboard.press("Control+A");
  await page.keyboard.type("const escape = ");
  await page.waitForTimeout(650);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const afterEscape = await page.evaluate(() => navigator.clipboard.readText());
  if (afterEscape.includes("99")) throw new Error("Escape did not discard ghost text");

  await page.keyboard.type("const typed = ");
  await page.waitForTimeout(650);
  await page.keyboard.type("0");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const afterTyping = await page.evaluate(() => navigator.clipboard.readText());
  if (afterTyping.includes("77")) throw new Error("Typing did not discard stale ghost text");

  await page.keyboard.type("const moved = ");
  await page.waitForTimeout(650);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const afterMove = await page.evaluate(() => navigator.clipboard.readText());
  if (afterMove.includes("66")) throw new Error("Cursor movement did not discard ghost text");

  await page.keyboard.type("const switched = ");
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: /index\.ts/ }).click();
  await editor.click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+C");
  const afterFileSwitch = await page.evaluate(() => navigator.clipboard.readText());
  if (afterFileSwitch.includes("55")) throw new Error("File switch kept stale ghost text");

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  let mobileRequests = 0;
  await mobile.route("**/chat/api/studio/autocomplete", async (route) => {
    mobileRequests += 1;
    await route.abort();
  });
  await mobile.goto(`${baseUrl}/studio`, { waitUntil: "networkidle" });
  await mobile.locator(".monaco-editor").click();
  await mobile.keyboard.press("Control+A");
  await mobile.keyboard.type("const mobile = ");
  await mobile.waitForTimeout(700);
  if (mobileRequests !== 0) throw new Error("Mobile must not request autocomplete");

  console.log("Studio autocomplete deterministic smoke: OK");
  await context.close();
} finally {
  await browser.close();
}
```

O smoke lê o conteúdo aceito pela própria ação de copiar do Monaco, usando uma permissão de clipboard restrita ao contexto efêmero do Playwright. Não expor `window.monaco`, não duplicar o script em atributos DOM e não imprimir conteúdo do editor.

- [ ] **Step 2: Add a short real-provider smoke**

Criar `scripts/smoke-studio-autocomplete-real.mjs` que lê `DEEPSEEK_API_KEY` apenas de `process.env`, nunca imprime chave, prompt ou resposta completa, e envia código sintético:

```js
import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) throw new Error("DEEPSEEK_API_KEY is required");
const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/beta" });
const response = await client.completions.create({
  model: "deepseek-v4-pro",
  prompt: "function soma(a: number, b: number) {\n  return ",
  suffix: ";\n}",
  max_tokens: 32,
  temperature: 0.1,
});
const choice = response.choices[0];
if (!choice?.text || choice.finish_reason !== "stop") {
  throw new Error(`FIM smoke failed with finish_reason=${choice?.finish_reason ?? "missing"}`);
}
console.log("DeepSeek FIM contract smoke: OK");
```

- [ ] **Step 3: Update living documentation**

Documentar em `docs/API.md` o request/response exato, 32k, auth, 429 e ausência de logs de código. Em `docs/ARCHITECTURE.md`, adicionar provider/coordenador/rota mantendo chat read-only. Em `docs/INFRASTRUCTURE.md`, documentar `RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM=180` e `DEEPSEEK_API_KEY` também como credencial FIM. Em `README.md`, incluir autocomplete desktop TS/JS no resumo do Studio. Em `/etc/apache2/APACHE.md`, adicionar:

```markdown
| `/chat/api/studio/autocomplete` | 3040 | Gaucho Studio DeepSeek FIM autocomplete (desktop TS/JS, não streaming) | No | JWT/app auth | OK |
```

Nenhuma nova regra `ProxyPass` é necessária; manter `ProxyPassReverseCookiePath / /chat` dentro de `<Location /chat>`.

- [ ] **Step 4: Run documentation and deterministic smoke checks**

Run: `git diff --check && node scripts/smoke-studio-autocomplete.mjs`

Expected: `Studio autocomplete deterministic smoke: OK`; nenhuma conversa, nota ou arquivo server-side criado.

- [ ] **Step 5: Commit smoke and docs**

```bash
git add scripts/smoke-studio-autocomplete.mjs scripts/smoke-studio-autocomplete-real.mjs scripts/README.md README.md docs/API.md docs/ARCHITECTURE.md docs/INFRASTRUCTURE.md
git commit -m "docs(studio): document FIM autocomplete contract"
```

Nota operacional: `/etc/apache2/APACHE.md` não pertence ao repositório Git; atualizar e validar no host, mas não esperar que `git add` o versione. O commit deve conter apenas os arquivos do repo.

### Task 8: Validar integração completa e publicar com segurança

**Files:**
- Verify: all files touched by Tasks 1–7
- Verify: `/etc/apache2/APACHE.md`

- [ ] **Step 1: Run all focused RED/GREEN neighbors**

Run: `npm test -- lib/studio/workspace.test.ts lib/studio/autocomplete.test.ts lib/server/studioAutocomplete.test.ts app/api/studio/autocomplete/route.test.ts lib/studio/autocompleteProvider.test.ts components/studio/StudioAutocompleteControl.test.tsx proxy.test.ts lib/security/rateLimit.test.ts`

Expected: PASS for every focused file.

- [ ] **Step 2: Run the full quality ladder**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build && git diff --check && npm audit --omit=dev`

Expected: all commands exit 0 and audit reports zero production vulnerabilities. If lint reports an unrelated existing failure, record `PRE_EXISTING_FAILURE` with the exact file and still require build success.

- [ ] **Step 3: Run the real FIM smoke without exposing secrets**

Run: `set -a; . ./.env.production; set +a; node scripts/smoke-studio-autocomplete-real.mjs`

Expected: `DeepSeek FIM contract smoke: OK`. Do not print completion content, request body or key.

- [ ] **Step 4: Restart and verify local/public health**

Run: `apachectl configtest && systemctl restart chatgpt.service && systemctl is-active chatgpt.service && curl --fail --silent http://127.0.0.1:3040/chat/api/health && curl --fail --silent https://ultrassom.ai/chat/api/health`

Expected: Apache `Syntax OK`, service `active`, and both health requests return healthy HTTP 200 responses.

- [ ] **Step 5: Run the authenticated deterministic browser smoke against production**

Run `node scripts/smoke-studio-autocomplete.mjs` with smoke credentials supplied as environment variables and without printing them.

Expected: ghost text accepted by `Tab`, one-step undo, stale response suppressed, `Esc`/typing/cursor/file change cancellation verified by the script, chained suggestion requested after 450 ms, and zero mobile requests.

- [ ] **Step 6: Inspect logs for content leakage**

Run a bounded search over `/var/log/chatgpt/app.log` and `/var/log/chatgpt/error.log` for the synthetic smoke marker only. Expected: no prompt, suffix, completion or API key appears; only sanitized status diagnostics may exist.

- [ ] **Step 7: Final completion audit**

Re-read `docs/superpowers/specs/2026-08-06-gaucho-studio-fim-autocomplete-design.md` requirement by requirement and point each criterion to test, browser smoke, route response, config or runtime evidence. Confirm explicitly that Python, mobile autocomplete, multifile imports and chat auto-apply remain absent.

- [ ] **Step 8: Confirm a clean verification handoff**

Run: `git status --short`

Expected: no uncommitted implementation changes. If the command lists a file, return to the task that owns that file, repeat its RED/GREEN cycle and commit the focused correction before the final audit. Do not mark the bundle or active goal complete until Anders reviews the delivered behavior.
