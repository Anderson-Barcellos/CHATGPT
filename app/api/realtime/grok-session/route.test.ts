import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), token: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
vi.mock("@/lib/server/soundcase/grokRealtime", () => ({ createSoundCaseGrokEphemeralToken: mocks.token, SoundCaseGrokRealtimeError: class extends Error {} }));
import { POST } from "@/app/api/realtime/grok-session/route";

beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue(null); mocks.token.mockResolvedValue("ephemeral"); });

describe("Chat Grok Realtime session", () => {
  it("requires authentication before requesting a token", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await POST(new NextRequest("http://local/api/realtime/grok-session", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("returns an ephemeral token without caching it", async () => {
    const response = await POST(new NextRequest("http://local/api/realtime/grok-session", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ token: "ephemeral" });
    expect(mocks.token).toHaveBeenCalledOnce();
  });
});
