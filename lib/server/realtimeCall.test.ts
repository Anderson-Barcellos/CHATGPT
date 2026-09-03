import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRealtimeSession,
  createRealtimeCallResponse,
  readRealtimeSdp,
} from "@/lib/server/realtimeCall";

const previousKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("answer", { status: 201 })));
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
  vi.unstubAllGlobals();
});

describe("shared Realtime call", () => {
  it("preserves Chat config and isolates SoundCase direction", () => {
    const chat = buildRealtimeSession({ product: "chat", voice: "cedar" });
    expect(chat).not.toHaveProperty("max_output_tokens");
    expect(chat.instructions).toContain("subtle southern Brazilian gaucho cadence");
    const soundcase = buildRealtimeSession({
      product: "soundcase", voice: "marin", speed: 1.2, instructions: "Tom sereno.",
    });
    expect(soundcase).toMatchObject({
      type: "realtime", model: "gpt-realtime-2.1-mini", output_modalities: ["audio"],
      audio: { output: { voice: "marin", speed: 1.2 } },
    });
    expect(soundcase.instructions).toContain("Tom sereno.");
    expect(soundcase.instructions).toContain("exact text");
  });

  it("posts typed multipart and forwards the abort signal", async () => {
    const controller = new AbortController();
    const request = new Request("http://local", { signal: controller.signal });
    const response = await createRealtimeCallResponse({
      request, sdp: "v=0\r\n", session: buildRealtimeSession({ product: "chat", voice: "cedar" }),
      safetyIdentifier: "test-realtime",
    });
    expect(response.status).toBe(201);
    expect(fetch).toHaveBeenCalledWith("https://api.openai.com/v1/realtime/calls", expect.objectContaining({
      signal: request.signal,
      headers: expect.objectContaining({ "OpenAI-Safety-Identifier": "test-realtime" }),
      body: expect.stringContaining('name="session"'),
    }));
  });

  it("stops reading a streamed SDP as soon as the byte limit is crossed", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("1234"));
        controller.enqueue(new TextEncoder().encode("5678"));
      },
      cancel,
    });
    const request = new Request("http://local", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readRealtimeSdp(request, 5)).rejects.toMatchObject({ code: "too_large" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("never returns or logs a raw provider error body", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { message: "private persisted direction" } }),
      { status: 400, headers: { "x-request-id": "req-safe" } }
    ));
    const response = await createRealtimeCallResponse({
      request: new Request("http://local"), sdp: "v=0", session: {}, safetyIdentifier: "safe",
    });
    expect(await response.text()).not.toContain("private persisted direction");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private persisted direction");
    log.mockRestore();
  });
});
