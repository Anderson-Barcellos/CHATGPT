import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

describe("/api/realtime/tts-call route", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("answer-sdp", {
          status: 200,
          headers: { "Content-Type": "application/sdp" },
        })
      )
    );
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
  });

  it("rejects empty SDP payloads", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call", {
        method: "POST",
        body: " ",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "SDP obrigatório para iniciar Realtime.",
    });
  });

  it("posts a realtime mini session with a normalized voice", async () => {
    const { POST, buildRealtimeTtsSessionConfig } = await import("./route");

    expect(buildRealtimeTtsSessionConfig("onyx").audio.output.voice).toBe("marin");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call?voice=cedar", {
        method: "POST",
        body: "offer-sdp",
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/sdp");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "OpenAI-Safety-Identifier": "gaucho-chat-tts-lab",
        }),
      })
    );
  });
});
