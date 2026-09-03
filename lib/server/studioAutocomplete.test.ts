import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  STUDIO_FIM_PROVIDERS,
  buildStudioFimParams,
  createStudioFimClient,
  parseStudioAutocompleteRequest,
  requestStudioFimCompletion,
} from "@/lib/server/studioAutocomplete";

const validRequest = {
  filePath: "src/index.ts",
  language: "typescript" as const,
  prefix: "const total = ",
  suffix: ";",
};

const ENV_KEYS = [
  "CODESTRAL_API_KEY",
  "MISTRAL_API_KEY",
  "DEEPSEEK_API_KEY",
  "OPENAI_LOG",
] as const;
const previousEnv = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]] as const)
);

function clearProviderEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  for (const [key, value] of previousEnv) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("Studio autocomplete server contract", () => {
  it("accepts only the exact browser contract", () => {
    expect(parseStudioAutocompleteRequest(validRequest)).toMatchObject({
      ok: true,
      value: validRequest,
    });
    expect(
      parseStudioAutocompleteRequest({ ...validRequest, extra: true })
    ).toMatchObject({
      ok: false,
      code: "studio_autocomplete_body_invalid",
    });
  });

  it("accepts the whole script for any prefix/suffix split through 32k", () => {
    expect(
      parseStudioAutocompleteRequest({
        ...validRequest,
        prefix: "x".repeat(31_000),
        suffix: "y".repeat(1_000),
      })
    ).toMatchObject({ ok: true });
  });

  it("accepts python as an autocomplete language", () => {
    expect(
      parseStudioAutocompleteRequest({
        ...validRequest,
        language: "python",
      })
    ).toMatchObject({ ok: true, value: { language: "python" } });
  });

  it.each([
    null,
    { ...validRequest, filePath: "" },
    { ...validRequest, filePath: "x".repeat(321) },
    { ...validRequest, language: "json" },
    { ...validRequest, prefix: 42 },
    { ...validRequest, suffix: null },
    { ...validRequest, prefix: "x".repeat(32_001) },
    {
      ...validRequest,
      prefix: "x".repeat(24_001),
      suffix: "y".repeat(8_000),
    },
  ])("rejects invalid input %#", (body) => {
    expect(parseStudioAutocompleteRequest(body)).toMatchObject({ ok: false });
  });

  it("declares the Codestral-first provider table", () => {
    expect(STUDIO_FIM_PROVIDERS.codestral).toEqual({
      baseURL: "https://codestral.mistral.ai/v1",
      model: "codestral-latest",
      envKey: "CODESTRAL_API_KEY",
    });
    expect(STUDIO_FIM_PROVIDERS.mistral).toEqual({
      baseURL: "https://api.mistral.ai/v1",
      model: "codestral-latest",
      envKey: "MISTRAL_API_KEY",
    });
    expect(STUDIO_FIM_PROVIDERS.deepseek).toEqual({
      baseURL: "https://api.deepseek.com/beta",
      model: "deepseek-v4-pro",
      envKey: "DEEPSEEK_API_KEY",
    });
  });

  it("builds a non-reasoning FIM request per provider", () => {
    expect(buildStudioFimParams("codestral", validRequest)).toEqual({
      model: "codestral-latest",
      prompt: validRequest.prefix,
      suffix: validRequest.suffix,
      max_tokens: 256,
      temperature: 0.1,
    });
    expect(buildStudioFimParams("deepseek", validRequest)).toEqual({
      model: "deepseek-v4-pro",
      prompt: validRequest.prefix,
      suffix: validRequest.suffix,
      max_tokens: 256,
      temperature: 0.1,
    });
    expect(
      JSON.stringify(buildStudioFimParams("codestral", validRequest))
    ).not.toMatch(/reasoning|thinking|tools|messages/);
  });

  it("selects Codestral first, then Mistral, then DeepSeek", () => {
    clearProviderEnv();
    expect(createStudioFimClient()).toBeNull();

    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    expect(createStudioFimClient()?.provider).toBe("deepseek");

    process.env.MISTRAL_API_KEY = "mistral-key";
    expect(createStudioFimClient()?.provider).toBe("mistral");

    process.env.CODESTRAL_API_KEY = "codestral-key";
    expect(createStudioFimClient()?.provider).toBe("codestral");
  });

  it("creates a dedicated quiet client bound to the provider base URL", () => {
    clearProviderEnv();
    process.env.CODESTRAL_API_KEY = "codestral-key";
    process.env.OPENAI_LOG = "debug";

    const fim = createStudioFimClient();
    expect(fim?.client.baseURL).toBe(STUDIO_FIM_PROVIDERS.codestral.baseURL);
    expect(fim?.client.maxRetries).toBe(0);
    expect(fim?.client.logLevel).toBe("off");
  });

  it("calls the Mistral FIM route and reads chat-shaped choices", async () => {
    const post = vi.fn().mockResolvedValue({
      choices: [
        {
          message: { content: "42", role: "assistant" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 8, completion_tokens: 1 },
    });
    const fim = { client: { post }, provider: "codestral" as const };
    const signal = new AbortController().signal;

    await expect(
      requestStudioFimCompletion(fim as never, validRequest, signal)
    ).resolves.toEqual({ completion: "42", finishReason: "stop" });
    expect(post).toHaveBeenCalledWith("/fim/completions", {
      body: buildStudioFimParams("codestral", validRequest),
      signal,
    });
  });

  it("keeps the DeepSeek legacy completions path intact", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ text: "42", finish_reason: "stop" }],
      usage: { prompt_tokens: 20, completion_tokens: 1 },
    });
    const fim = {
      client: { completions: { create } },
      provider: "deepseek" as const,
    };
    const signal = new AbortController().signal;

    await expect(
      requestStudioFimCompletion(fim as never, validRequest, signal)
    ).resolves.toEqual({ completion: "42", finishReason: "stop" });
    expect(create).toHaveBeenCalledWith(
      buildStudioFimParams("deepseek", validRequest),
      { signal }
    );
  });

  it("normalizes Mistral finish reasons into the browser contract", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: { content: "partial" },
            finish_reason: "model_length",
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "odd" }, finish_reason: "error" }],
      })
      .mockResolvedValueOnce({ choices: [] });
    const fim = { client: { post }, provider: "mistral" as const };
    const signal = new AbortController().signal;

    await expect(
      requestStudioFimCompletion(fim as never, validRequest, signal)
    ).resolves.toEqual({ completion: "partial", finishReason: "length" });
    await expect(
      requestStudioFimCompletion(fim as never, validRequest, signal)
    ).resolves.toEqual({
      completion: "odd",
      finishReason: "insufficient_system_resource",
    });
    await expect(
      requestStudioFimCompletion(fim as never, validRequest, signal)
    ).resolves.toEqual({
      completion: "",
      finishReason: "insufficient_system_resource",
    });
  });
});
