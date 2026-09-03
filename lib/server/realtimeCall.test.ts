import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRealtimeSession, createRealtimeCallResponse } from "@/lib/server/realtimeCall";

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
});
