import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSoundCaseDraftOnExitBestEffort, soundCaseApi } from "@/lib/soundcase/api";

describe("SoundCase client API", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/chat";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ projects: [] }))));
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.unstubAllGlobals();
  });

  it("uses the configured base path to list projects", async () => {
    await soundCaseApi.listProjects();
    expect(fetch).toHaveBeenCalledWith("/chat/api/soundcase/projects", { cache: "no-store" });
  });

  it("sends the current revision in autosave CAS payloads", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "p" } })));
    await soundCaseApi.saveDraft("project/id", { text: "local", revision: 7 });
    expect(fetch).toHaveBeenCalledWith("/chat/api/soundcase/projects/project%2Fid", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ text: "local", revision: 7 }),
    }));
  });

  it("builds authenticated asset URLs without fetching them", () => {
    expect(soundCaseApi.audioUrl("p/1", "v 2")).toBe(
      "/chat/api/soundcase/projects/p%2F1/versions/v%202/audio"
    );
  });

  it("flushes the latest draft through an authenticated beacon on page exit", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon });

    flushSoundCaseDraftOnExitBestEffort("project/id", { text: "última edição", revision: 8 });
    expect(sendBeacon).toHaveBeenCalledWith(
      "/chat/api/soundcase/projects/project%2Fid",
      expect.any(Blob)
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive POST when beacon declines the payload", () => {
    vi.stubGlobal("navigator", { sendBeacon: vi.fn().mockReturnValue(false) });

    flushSoundCaseDraftOnExitBestEffort("p", { text: "rascunho", revision: 2 });
    expect(fetch).toHaveBeenCalledWith("/chat/api/soundcase/projects/p", expect.objectContaining({
      method: "POST", keepalive: true, credentials: "same-origin",
      body: JSON.stringify({ text: "rascunho", revision: 2 }),
    }));
  });
});
