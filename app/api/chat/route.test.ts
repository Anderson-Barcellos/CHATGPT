import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const geminiMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createEventStream: vi.fn(),
}));

const anthropicMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createEventStream: vi.fn(),
  isInputError: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: () => false,
  isAuthenticatedRequest: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/server/geminiChat", () => ({
  GEMINI_MODEL: "gemini-3.8-flash",
  createGeminiClient: geminiMocks.createClient,
  createGeminiEventStream: geminiMocks.createEventStream,
}));

vi.mock("@/lib/server/anthropicChat", () => ({
  createAnthropicClient: anthropicMocks.createClient,
  createAnthropicEventStream: anthropicMocks.createEventStream,
  isAnthropicInputError: anthropicMocks.isInputError,
}));

vi.mock("@/lib/server/chatToolOrchestrator", () => ({
  createMemoryToolEventStream: vi.fn(),
  createResponseWithMemoryTools: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";
import { createMemoryToolEventStream, createResponseWithMemoryTools } from "@/lib/server/chatToolOrchestrator";

function requestFor(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/chat/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: [{ role: "user", content: "Oi" }],
      model: "gemini-3.8-flash",
      stream: true,
      responseMode: "default",
      ...body,
    }),
  });
}

describe("Gemini chat route", () => {
  const previousOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    geminiMocks.createClient.mockReset();
    geminiMocks.createEventStream.mockReset();
  });

  afterEach(() => {
    if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAIKey;
  });

  it("streams Gemini through the provider adapter", async () => {
    const client = {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    geminiMocks.createClient.mockReturnValue(client);
    geminiMocks.createEventStream.mockResolvedValue(stream);

    const response = await POST(requestFor({}));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(geminiMocks.createEventStream).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ model: "gemini-3.8-flash" }),
      expect.any(AbortSignal)
    );
  });

  it("returns a provider-specific 503 when GEMINI_API_KEY is unavailable", async () => {
    geminiMocks.createClient.mockReturnValue(null);

    const response = await POST(requestFor({}));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "chat_gemini_api_key_missing",
    });
  });

  it.each([
    [{ responseMode: "document" }, "chat_gemini_mode_not_supported"],
    [{ stream: false }, "chat_gemini_stream_required"],
  ])("rejects unsupported Gemini request %o", async (overrides, code) => {
    const response = await POST(requestFor(overrides));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
  });
});

describe("Claude na rota", () => {
  beforeEach(() => {
    anthropicMocks.createClient.mockReset();
    anthropicMocks.createEventStream.mockReset();
    anthropicMocks.isInputError.mockReturnValue(false);
  });

  it("encaminha Claude streaming pelo adaptador oficial", async () => {
    const client = {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    anthropicMocks.createClient.mockReturnValue(client);
    anthropicMocks.createEventStream.mockReturnValue(stream);

    const response = await POST(requestFor({ model: "claude-sonnet-5-5" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(anthropicMocks.createEventStream).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ model: "claude-sonnet-5-5" }),
      expect.any(AbortSignal)
    );
  });

  it("retorna 503 específico quando a chave Anthropic não está disponível", async () => {
    anthropicMocks.createClient.mockReturnValue(null);

    const response = await POST(requestFor({ model: "claude-opus-5-5" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "chat_anthropic_api_key_missing",
    });
  });

  it.each([
    [{ responseMode: "document" }, "chat_anthropic_mode_not_supported"],
    [{ stream: false }, "chat_anthropic_stream_required"],
  ])("rejeita requisição Claude incompatível %o", async (overrides, code) => {
    const response = await POST(requestFor({
      model: "claude-sonnet-5-5",
      ...overrides,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code });
  });
});

describe("modelos legados de Grok e mini", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "chave-de-teste");
    vi.mocked(createMemoryToolEventStream).mockReset();
    vi.mocked(createResponseWithMemoryTools).mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["grok-4.7", "gpt-5.4-mini"])("encaminha %s ao OpenAI no GPT-6 Luna, com stream", async (model) => {
    vi.mocked(createMemoryToolEventStream).mockReturnValue(new ReadableStream<Uint8Array>({
      start(controller) { controller.close(); },
    }));

    const response = await POST(requestFor({ model }));

    expect(response.status).toBe(200);
    expect(createMemoryToolEventStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "gpt-6-luna" }),
      expect.any(AbortSignal)
    );
  });

  it("preserva o contrato nonstream do Grok legado pelo OpenAI", async () => {
    const providerResponse = { id: "resp-luna", status: "completed", output_text: "ok", output: [] };
    vi.mocked(createResponseWithMemoryTools).mockResolvedValue(providerResponse as never);

    const response = await POST(requestFor({ model: "grok-4.7", stream: false }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(providerResponse);
    expect(createResponseWithMemoryTools).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "gpt-6-luna" }),
      expect.any(AbortSignal)
    );
  });
});

describe("DeepSeek V4.1 Flash na rota", () => {
  it("nomeia o V4.1 Flash ao recusar modo que não seja chat padrão", async () => {
    const response = await POST(requestFor({ model: "deepseek-flash", responseMode: "deepsearch" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("chat_deepseek_mode_not_supported");
    expect(body.message).toContain("DeepSeek V4.1 Flash");
    expect(body.message).not.toContain("V4 Pro");
  });

  it("nomeia o V4.1 Flash ao exigir streaming", async () => {
    const response = await POST(requestFor({ model: "deepseek-flash", stream: false }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("chat_deepseek_stream_required");
    expect(body.message).toContain("DeepSeek V4.1 Flash");
    expect(body.message).not.toContain("V4 Pro");
  });

  it("aceita o id antigo deepseek-v4-pro e cobra pelo nome novo", async () => {
    const response = await POST(requestFor({ model: "deepseek-v4-pro", stream: false }));
    const body = await response.json();

    expect(body.code).toBe("chat_deepseek_stream_required");
    expect(body.message).toContain("DeepSeek V4.1 Flash");
  });
});
