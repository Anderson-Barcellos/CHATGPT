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
          status: 201,
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

  it("posts a realtime 2.1 mini session with typed multipart SDP and no token cap", async () => {
    const {
      POST,
      buildRealtimeCallMultipartBody,
      buildRealtimeTtsSessionConfig,
    } = await import("./route");

    expect(buildRealtimeTtsSessionConfig("onyx").audio.output.voice).toBe("marin");
    expect(buildRealtimeTtsSessionConfig("onyx").type).toBe("realtime");
    expect(buildRealtimeTtsSessionConfig("onyx").output_modalities).toEqual([
      "audio",
    ]);
    expect(buildRealtimeTtsSessionConfig("onyx")).not.toHaveProperty(
      "modalities"
    );
    expect(buildRealtimeTtsSessionConfig("onyx")).not.toHaveProperty(
      "max_output_tokens"
    );
    expect(buildRealtimeTtsSessionConfig("onyx")).not.toHaveProperty("voice");
    expect(buildRealtimeTtsSessionConfig("cedar").instructions).toContain(
      "subtle southern Brazilian gaucho cadence"
    );
    expect(buildRealtimeTtsSessionConfig("cedar").instructions).toContain(
      "Do not add regional slang"
    );
    const multipart = buildRealtimeCallMultipartBody("v=0\r\n", "cedar");

    expect(multipart.contentType).toContain("multipart/form-data; boundary=");
    expect(multipart.body).toContain('Content-Disposition: form-data; name="sdp"');
    expect(multipart.body).toContain("Content-Type: application/sdp");
    expect(multipart.body).toContain("v=0\r\n");
    expect(multipart.body).toContain('Content-Disposition: form-data; name="session"');
    expect(multipart.body).toContain("Content-Type: application/json");
    expect(multipart.body).toContain('"model":"gpt-realtime-2.1-mini"');
    expect(multipart.body).not.toContain("max_output_tokens");
    expect(multipart.body).toContain("Codex-like presence");

    const response = await POST(
      new NextRequest("http://localhost/api/realtime/tts-call?voice=cedar", {
        method: "POST",
        body: "v=0\r\n",
      })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toContain("application/sdp");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "OpenAI-Safety-Identifier": "gaucho-chat-tts-lab",
          "Content-Type": expect.stringContaining("multipart/form-data; boundary="),
        }),
        body: expect.stringContaining('Content-Disposition: form-data; name="sdp"'),
      })
    );
  });
});
