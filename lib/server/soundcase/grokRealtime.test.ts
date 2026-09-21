import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createSoundCaseGrokEphemeralToken, listSoundCaseGrokVoices } from "@/lib/server/soundcase/grokRealtime";

const originalXai = process.env.XAI_API_KEY;
const originalGrok = process.env.GROK_API_KEY;
afterEach(() => { if (originalXai === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = originalXai; if (originalGrok === undefined) delete process.env.GROK_API_KEY; else process.env.GROK_API_KEY = originalGrok; vi.unstubAllGlobals(); });

describe("SoundCase Grok Realtime server adapter", () => {
  it("mints a five-minute token with XAI_API_KEY before the GROK alias", async () => {
    process.env.XAI_API_KEY = "xai-key"; process.env.GROK_API_KEY = "grok-key";
    const fetchMock = vi.fn(async () => Response.json({ value: "ephemeral" })); vi.stubGlobal("fetch", fetchMock);
    await expect(createSoundCaseGrokEphemeralToken()).resolves.toBe("ephemeral");
    expect(fetchMock).toHaveBeenCalledWith("https://api.x.ai/v1/realtime/client_secrets", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer xai-key" }), body: JSON.stringify({ expires_after: { seconds: 300 } }) }));
  });
  it("accepts GROK_API_KEY as the process alias and maps the voice list", async () => {
    delete process.env.XAI_API_KEY; process.env.GROK_API_KEY = "grok-key";
    const fetchMock = vi.fn(async () => Response.json({ voices: [{ voice_id: "eve", name: "Eve" }, { voice_id: "ara", name: "Ara" }, { id: "leo" }] })); vi.stubGlobal("fetch", fetchMock);
    await expect(listSoundCaseGrokVoices()).resolves.toEqual([{ id: "eve", name: "Eve" }, { id: "ara", name: "Ara" }, { id: "leo", name: "leo" }]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.x.ai/v1/tts/voices", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer grok-key" }) }));
  });
  it("reports a missing key as an unavailable configuration before attempting the network", async () => {
    delete process.env.XAI_API_KEY; delete process.env.GROK_API_KEY;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(createSoundCaseGrokEphemeralToken()).rejects.toMatchObject({ code: "soundcase_grok_realtime_unavailable", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("combines the route signal with the upstream request so an abandoned mint is cancelled", async () => {
    process.env.XAI_API_KEY = "xai-key";
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const request = createSoundCaseGrokEphemeralToken(controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: "soundcase_grok_realtime_network" });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
