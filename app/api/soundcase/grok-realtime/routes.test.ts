import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ requireAppAuth: vi.fn(), getSoundCaseVersion: vi.fn(), createToken: vi.fn(), listVoices: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/server/soundcase/jobs", () => ({ getSoundCaseVersion: mocks.getSoundCaseVersion }));
vi.mock("@/lib/server/soundcase/grokRealtime", () => ({ createSoundCaseGrokEphemeralToken: mocks.createToken, listSoundCaseGrokVoices: mocks.listVoices }));
import { POST } from "@/app/api/soundcase/grok-realtime/session/route";
import { GET } from "@/app/api/soundcase/grok-realtime/voices/route";

beforeEach(() => {
  vi.clearAllMocks(); mocks.requireAppAuth.mockResolvedValue(null);
  mocks.getSoundCaseVersion.mockResolvedValue({ id: VERSION_ID, projectId: PROJECT_ID, direction: { title: "Leitura" } });
  mocks.createToken.mockResolvedValue("temporary-token"); mocks.listVoices.mockResolvedValue([{ id: "eve", name: "Eve" }]);
});
afterEach(() => vi.unstubAllGlobals());

describe("SoundCase Grok Realtime routes", () => {
  it("authenticates before validating or minting a token", async () => {
    mocks.requireAppAuth.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await POST(new NextRequest("http://local/api/soundcase/grok-realtime/session"));
    expect(response.status).toBe(401); expect(mocks.getSoundCaseVersion).not.toHaveBeenCalled(); expect(mocks.createToken).not.toHaveBeenCalled();
  });
  it("validates the immutable version before minting a no-store token", async () => {
    const response = await POST(new NextRequest(`http://local/api/soundcase/grok-realtime/session?projectId=${PROJECT_ID}&versionId=${VERSION_ID}`, { method: "POST" }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getSoundCaseVersion).toHaveBeenCalledWith(PROJECT_ID, VERSION_ID); expect(await response.json()).toEqual({ token: "temporary-token" });
  });
  it("does not mint without persisted direction", async () => {
    mocks.getSoundCaseVersion.mockResolvedValue({ id: VERSION_ID, projectId: PROJECT_ID, direction: null });
    const response = await POST(new NextRequest(`http://local/api/soundcase/grok-realtime/session?projectId=${PROJECT_ID}&versionId=${VERSION_ID}`, { method: "POST" }));
    expect(response.status).toBe(409); expect(mocks.createToken).not.toHaveBeenCalled();
  });
  it("lists voices only after app authentication and prevents caching", async () => {
    const response = await GET(new NextRequest("http://local/api/soundcase/grok-realtime/voices"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(await response.json()).toEqual({ voices: [{ id: "eve", name: "Eve" }] });
  });
});
