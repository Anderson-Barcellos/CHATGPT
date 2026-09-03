import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ requireAppAuth: vi.fn(), getSoundCaseVersion: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/server/soundcase/jobs", () => ({ getSoundCaseVersion: mocks.getSoundCaseVersion }));
import { POST } from "@/app/api/soundcase/realtime-call/route";

const previousKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAppAuth.mockResolvedValue(null);
  mocks.getSoundCaseVersion.mockResolvedValue({
    id: VERSION_ID, projectId: PROJECT_ID,
    direction: { title: "Leitura", segmentDirections: [] },
    effectiveSettings: {
      voice: { value: "marin", source: "automatic" },
      speed: { value: 1.1, source: "automatic" },
      instructions: { value: "Tom contemplativo persistido.", source: "automatic" },
    },
  });
  process.env.OPENAI_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("answer-sdp", { status: 201 })));
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  vi.unstubAllGlobals();
});

describe("SoundCase Realtime route", () => {
  it("authenticates before reading SDP", async () => {
    mocks.requireAppAuth.mockResolvedValue(new Response(null, { status: 401 }));
    const text = vi.fn(() => { throw new Error("must not read"); });
    const response = await POST({ text } as unknown as NextRequest);
    expect(response.status).toBe(401);
    expect(text).not.toHaveBeenCalled();
  });

  it("resolves voice and direction by authenticated ids without accepting free instructions", async () => {
    const request = new NextRequest(
      `http://local/api/soundcase/realtime-call?projectId=${PROJECT_ID}&versionId=${VERSION_ID}&instructions=evil`,
      { method: "POST", body: "v=0\r\n" }
    );
    const response = await POST(request);
    expect(response.status).toBe(201);
    const fetchInput = vi.mocked(fetch).mock.calls[0][1]!;
    expect(String(fetchInput.body)).toContain("Tom contemplativo persistido.");
    expect(String(fetchInput.body)).not.toContain("evil");
    expect(String(fetchInput.body)).not.toContain("fonte privada");
  });

  it("requires persisted direction before opening a paid session", async () => {
    mocks.getSoundCaseVersion.mockResolvedValue({ id: VERSION_ID, projectId: PROJECT_ID, direction: null, effectiveSettings: null });
    const response = await POST(new NextRequest(
      `http://local/api/soundcase/realtime-call?projectId=${PROJECT_ID}&versionId=${VERSION_ID}`,
      { method: "POST", body: "v=0\r\n" }
    ));
    expect(response.status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });
});
