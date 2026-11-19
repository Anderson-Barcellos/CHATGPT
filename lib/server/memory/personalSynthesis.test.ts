import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  sources: [{ id: "profile:about", text: "Em 2024, Ana não usava café. Hoje não sabemos.", updatedAt: undefined as string | undefined }],
  hash: "revision-1", files: new Map<string, unknown>(), create: vi.fn(), rebuild: vi.fn(),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/server/chatRequest", () => ({ createOpenAIClient: () => ({ responses: { create: mocks.create } }) }));
vi.mock("@/lib/server/jsonFileStore", () => ({
  readDataFile: async (name: string, fallback: unknown) => mocks.files.get(name) ?? fallback,
  writeDataFile: async (name: string, value: unknown) => { mocks.files.set(name, value); },
  withDataFileLock: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("./personalSources", () => ({
  readPersonalSources: async () => ({ sources: [...mocks.sources], hash: mocks.hash, persona: {} }),
  renderSources: (sources: Array<{ text: string }>) => sources.map(s => s.text).join("\n"),
}));
vi.mock("./personalIndex", () => ({ rebuildPersonalIndex: mocks.rebuild }));
import { getPersonalSynthesis, parseSynthesis, refreshPersonalSynthesis } from "./personalSynthesis";

function response(text = "Em 2024, Ana não usava café; situação atual desconhecida.") {
  return { status: "completed", output_text: JSON.stringify({ items: [{ text, sourceIds: ["profile:about"] }] }), usage: { input_tokens: 120, output_tokens: 70, total_tokens: 190 } };
}
beforeEach(() => {
  mocks.files.clear(); mocks.hash = "revision-1";
  mocks.sources = [{ id: "profile:about", text: "Em 2024, Ana não usava café. Hoje não sabemos.", updatedAt: undefined }];
  mocks.create.mockReset().mockResolvedValue(response()); mocks.rebuild.mockReset().mockResolvedValue(undefined);
});

describe("personal synthesis lifecycle", () => {
  it("uses originals until a completed attributed summary is available; reuses it without another generation", async () => {
    expect((await getPersonalSynthesis()).text).toContain("Hoje não sabemos");
    await refreshPersonalSynthesis(); await refreshPersonalSynthesis();
    const state = await getPersonalSynthesis();
    expect(state.valid).toBe(true); expect(state.text).toContain("situação atual desconhecida");
    expect(state.record.usage?.total_tokens).toBe(190); expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ model: "gpt-6-luna", reasoning: { effort: "low" }, store: false });
  });
  it("invalidates immediately after an edit and uses only current originals", async () => {
    await refreshPersonalSynthesis(); mocks.hash = "revision-2"; mocks.sources[0].text = "Agora prefere chá.";
    const state = await getPersonalSynthesis(); expect(state.valid).toBe(false); expect(state.text).toBe("Agora prefere chá.");
  });
  it("does not resurrect a removed source from a previous summary", async () => {
    await refreshPersonalSynthesis(); mocks.hash = "empty"; mocks.sources = [];
    expect((await getPersonalSynthesis()).text).toBe("");
    await refreshPersonalSynthesis(); expect((await getPersonalSynthesis()).valid).toBe(true); expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("discards a generation when its source changes in flight", async () => {
    mocks.create.mockImplementationOnce(async () => { mocks.hash = "revision-2"; mocks.sources[0].text = "Novo perfil"; return response(); });
    mocks.create.mockResolvedValueOnce(response("Novo perfil"));
    await refreshPersonalSynthesis();
    expect((await getPersonalSynthesis()).valid).toBe(true); expect((await getPersonalSynthesis()).text).toBe("Novo perfil");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("coalesces concurrent requests into one generation", async () => {
    await Promise.all([refreshPersonalSynthesis(), refreshPersonalSynthesis(), refreshPersonalSynthesis()]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("honors a manual regeneration requested during an in-flight generation", async () => {
    let finish!: (value: ReturnType<typeof response>) => void;
    mocks.create.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = refreshPersonalSynthesis();
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    const manual = refreshPersonalSynthesis(true);
    finish(response());
    await Promise.all([first, manual]);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect((await getPersonalSynthesis()).valid).toBe(true);
  });
  it("keeps originals on timeout, limits automatic retries and supports manual retry", async () => {
    mocks.create.mockRejectedValue(new Error("timeout with private provider details"));
    await refreshPersonalSynthesis(); await refreshPersonalSynthesis();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const state = await getPersonalSynthesis(); expect(state.status).toBe("failed"); expect(state.text).toContain("não usava café");
    expect(JSON.stringify(state.record)).not.toContain("private provider");
    await refreshPersonalSynthesis(true); expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("recovers an interrupted pending generation on the next access", async () => {
    mocks.files.set("personal-synthesis.json", { version: 1, hash: mocks.hash, status: "pending", attempts: 1, attemptedAt: 0 });
    await refreshPersonalSynthesis(); expect((await getPersonalSynthesis()).valid).toBe(true);
  });
  it.each(["incomplete", "failed"])('rejects provider status %s', async status => {
    mocks.create.mockResolvedValue({ ...response(), status }); await refreshPersonalSynthesis();
    expect((await getPersonalSynthesis()).valid).toBe(false);
  });
  it("rejects unknown sources, empty summaries and over-budget output instead of truncating", () => {
    for (const items of [[], [{ text: "Inventado", sourceIds: ["missing"] }], [{ text: "a".repeat(4001), sourceIds: ["profile:about"] }]]) {
      expect(() => parseSynthesis(JSON.stringify({ items }), mocks.sources)).toThrow();
    }
  });
});
