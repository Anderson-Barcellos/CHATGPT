import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { soundCaseApi } from "@/lib/soundcase/api";

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
});
