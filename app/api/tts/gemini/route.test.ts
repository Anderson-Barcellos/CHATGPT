import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), synthesize: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
vi.mock("@/lib/server/geminiTts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/geminiTts")>(),
  synthesizeGeminiTts: mocks.synthesize,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "sintetica");
  mocks.auth.mockResolvedValue(null);
  mocks.synthesize.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));
});

afterEach(() => vi.unstubAllEnvs());

function request(body: unknown) {
  return new NextRequest("http://local/api/tts/gemini", { method: "POST", body: JSON.stringify(body) });
}

describe("rota Gemini TTS", () => {
  it("exige autenticação antes de chamar o provedor", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await POST(request({ text: "Texto." }))).status).toBe(401);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it("devolve WAV privado e preserva parágrafos e preferências", async () => {
    const response = await POST(request({ text: "# Título\n\nSegundo parágrafo.", pace: "calmo", expressiveness: "alta" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/wav");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe("RIFF");
    expect(mocks.synthesize).toHaveBeenCalledWith("Título\n\nSegundo parágrafo.", "sintetica",
      { pace: "calmo", expressiveness: "alta" }, expect.any(AbortSignal));
  });

  it("recusa texto vazio, texto acima do limite e ambiente sem chave", async () => {
    expect((await POST(request({ text: " " }))).status).toBe(400);
    expect((await POST(request({ text: "a".repeat(20_001) }))).status).toBe(400);
    vi.stubEnv("GEMINI_API_KEY", undefined);
    expect((await POST(request({ text: "Texto." }))).status).toBe(503);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });
});
