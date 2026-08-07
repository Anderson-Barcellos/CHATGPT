import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  STUDIO_FIM_BASE_URL,
  STUDIO_FIM_MODEL,
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

const previousDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const previousOpenAiLog = process.env.OPENAI_LOG;

afterEach(() => {
  if (previousDeepSeekKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = previousDeepSeekKey;
  }
  if (previousOpenAiLog === undefined) {
    delete process.env.OPENAI_LOG;
  } else {
    process.env.OPENAI_LOG = previousOpenAiLog;
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

  it("builds a non-reasoning FIM request for the Beta API", () => {
    expect(STUDIO_FIM_BASE_URL).toBe("https://api.deepseek.com/beta");
    expect(STUDIO_FIM_MODEL).toBe("deepseek-v4-pro");
    expect(buildStudioFimParams(validRequest)).toEqual({
      model: "deepseek-v4-pro",
      prompt: validRequest.prefix,
      suffix: validRequest.suffix,
      max_tokens: 256,
      temperature: 0.1,
    });
    expect(JSON.stringify(buildStudioFimParams(validRequest))).not.toMatch(
      /reasoning|thinking|tools|messages/
    );
  });

  it("creates only the dedicated Beta client when a key exists", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(createStudioFimClient()).toBeNull();

    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.OPENAI_LOG = "debug";
    const client = createStudioFimClient();
    expect(client?.baseURL).toBe(STUDIO_FIM_BASE_URL);
    expect(client?.maxRetries).toBe(0);
    expect(client?.logLevel).toBe("off");
  });

  it("returns only completion and a supported finish reason", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ text: "42", finish_reason: "stop" }],
      usage: { prompt_tokens: 20, completion_tokens: 1 },
    });
    const client = { completions: { create } };
    const signal = new AbortController().signal;

    await expect(
      requestStudioFimCompletion(client as never, validRequest, signal)
    ).resolves.toEqual({ completion: "42", finishReason: "stop" });
    expect(create).toHaveBeenCalledWith(buildStudioFimParams(validRequest), {
      signal,
    });
  });

  it("normalizes unknown terminal reasons and missing choices", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ text: "partial", finish_reason: "provider_specific" }],
      })
      .mockResolvedValueOnce({ choices: [] });
    const client = { completions: { create } };
    const signal = new AbortController().signal;

    await expect(
      requestStudioFimCompletion(client as never, validRequest, signal)
    ).resolves.toEqual({
      completion: "partial",
      finishReason: "insufficient_system_resource",
    });
    await expect(
      requestStudioFimCompletion(client as never, validRequest, signal)
    ).resolves.toEqual({
      completion: "",
      finishReason: "insufficient_system_resource",
    });
  });
});
