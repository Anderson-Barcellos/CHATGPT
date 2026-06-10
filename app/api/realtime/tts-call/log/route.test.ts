import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

describe("/api/realtime/tts-call/log route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests when auth is enabled", async () => {
    isAuthEnabledMock.mockReturnValue(true);
    isAuthenticatedRequestMock.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call/log", {
        method: "POST",
        body: JSON.stringify({ event: "x", message: "y" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid json payload", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call/log", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Payload JSON inválido para log de Realtime.",
    });
  });

  it("logs valid payload with default warn level", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call/log", {
        method: "POST",
        body: JSON.stringify({
          event: "route.non_ok",
          message: "Falha upstream",
          details: { status: 400 },
        }),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "vitest",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(warnSpy).toHaveBeenCalledWith(
      "Realtime TTS client log",
      expect.objectContaining({
        event: "route.non_ok",
        message: "Falha upstream",
      })
    );
  });
});
