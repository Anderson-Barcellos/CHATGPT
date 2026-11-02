import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { create, authenticated } = vi.hoisted(() => ({
  create: vi.fn(), authenticated: vi.fn(),
}));

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class MockOpenAI {
    static APIError = actual.default.APIError;
    audio = { transcriptions: { create } };
  }
  return { ...actual, default: MockOpenAI };
});
vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: () => true,
  isAuthenticatedRequest: authenticated,
}));

import { POST } from "./route";

function audioRequest() {
  const form = new FormData();
  form.set("file", new File(["synthetic-audio"], "dictation.wav", { type: "audio/wav" }));
  return new NextRequest("http://localhost/api/transcribe", { method: "POST", body: form });
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticated.mockResolvedValue(true);
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  vi.stubEnv("TRANSCRIPTION_STREAMING_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("transcrição HTTP com GPT Transcribe", () => {
  it("preserva deltas e texto final NDJSON com o modelo novo", async () => {
    create.mockResolvedValue((async function* () {
      yield { type: "transcript.text.delta", delta: "Bom " };
      yield { type: "transcript.text.delta", delta: "dia." };
      yield { type: "transcript.text.done", text: "Bom dia." };
    })());
    const request = audioRequest();
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect((await response.text()).trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { type: "delta", delta: "Bom " },
      { type: "delta", delta: "dia." },
      { type: "done", text: "Bom dia." },
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-transcribe", file: expect.any(File), stream: true }),
      { signal: request.signal },
    );
  });

  it("mantém o modo JSON quando streaming está desativado", async () => {
    vi.stubEnv("TRANSCRIPTION_STREAMING_ENABLED", "false");
    create.mockResolvedValue({ text: "Anotação completa.", languages: [{ code: "pt" }] });
    const response = await POST(audioRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "Anotação completa." });
    expect(create).toHaveBeenCalledWith({ model: "gpt-transcribe", file: expect.any(File) });
  });

  it("não chama o provedor sem autenticação", async () => {
    authenticated.mockResolvedValue(false);
    const response = await POST(audioRequest());
    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("mantém erro de stream como NDJSON sem inventar conclusão", async () => {
    create.mockResolvedValue((async function* () {
      yield { type: "transcript.text.delta", delta: "Parcial" };
      throw new Error("Falha sintética de transcrição");
    })());
    const response = await POST(audioRequest());
    expect((await response.text()).trim().split("\n").map((line) => JSON.parse(line))).toEqual([
      { type: "delta", delta: "Parcial" },
      { type: "error", error: "Falha sintética de transcrição" },
    ]);
  });
});
