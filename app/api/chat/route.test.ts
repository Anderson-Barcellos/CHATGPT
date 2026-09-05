import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const geminiMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createEventStream: vi.fn(),
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

vi.mock("@/lib/server/chatToolOrchestrator", () => ({
  createMemoryToolEventStream: vi.fn(),
  createResponseWithMemoryTools: vi.fn(),
}));

import { POST } from "@/app/api/chat/route";

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
