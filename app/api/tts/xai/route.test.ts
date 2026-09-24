import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
import { POST } from "@/app/api/tts/xai/route";

const request = (body: unknown) => new NextRequest("http://local/api/tts/xai", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const previousXai = process.env.XAI_API_KEY;
const previousGrok = process.env.GROK_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  process.env.XAI_API_KEY = "test-key";
  delete process.env.GROK_API_KEY;
});
afterEach(() => {
  if (previousXai === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = previousXai;
  if (previousGrok === undefined) delete process.env.GROK_API_KEY; else process.env.GROK_API_KEY = previousGrok;
  vi.unstubAllGlobals();
});

describe("Chat/Pulse xAI TTS", () => {
  it("checks auth before generating audio", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ input: "Olá." }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("sends only the bounded Orion MP3 request and returns audio", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(new Uint8Array([0x49, 0x44, 0x33, 0x01]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({ input: "  Olá, Anders.  ", speed: 1.1, voice: "marin", format: "flac" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0x49, 0x44, 0x33, 0x01]);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.x.ai/v1/tts");
    expect(JSON.parse(String(init.body))).toEqual({
      text: "Olá, Anders.", voice_id: "orion", language: "pt-BR", speed: 1.1,
      output_format: { codec: "mp3", sample_rate: 24_000, bit_rate: 128_000 },
    });
    expect(init.headers).toEqual({ Authorization: "Bearer test-key", "Content-Type": "application/json" });
  });

  it("rejects unsupported speed before calling the provider", async () => {
    const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
    expect((await POST(request({ input: "Olá.", speed: 2 }))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not serve a JSON provider response as an MP3", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "unexpected" })));
    const response = await POST(request({ input: "Olá." }));
    expect(response.status).toBe(502);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });
});
