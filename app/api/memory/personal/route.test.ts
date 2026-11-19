import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ state: vi.fn(), search: vi.fn(), schedule: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
vi.mock("@/lib/server/memory/personalSynthesis", () => ({ getPersonalSynthesis: mocks.state, schedulePersonalSynthesis: mocks.schedule }));
vi.mock("@/lib/server/memory/personalIndex", () => ({ searchPersonalSources: mocks.search }));
vi.mock("@/lib/server/memory/personalSources", () => ({ renderSources: (sources: Array<{ text: string }>) => sources.map(s => s.text).join("\n") }));
import { GET, POST } from "./route";
function request(body: unknown) { return new NextRequest("http://localhost/chat/api/memory/personal", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue(null); mocks.search.mockResolvedValue([]);
  mocks.state.mockResolvedValue({ hash: "current", status: "ready", valid: true, text: "Síntese atual", originalChars: 100,
    persona: { responsePreferences: "Prosa", customSystemInstructions: "Regra" },
    sources: [{ id: "profile:about", text: "Perfil salvo" }, { id: "memory:1", text: "Memória ativa" }],
    record: { summary: "Síntese atual", generatedAt: "2026-11-13T12:00:00Z", items: [] },
  });
});
describe("authenticated personal context", () => {
  it("refuses anonymous access before reading or scheduling", async () => {
    mocks.auth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await GET(request({}))).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    expect(mocks.state).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("returns current server context rather than an old browser snapshot", async () => {
    const response = await POST(request({ query: "Minha preferência?" }));
    expect(await response.json()).toMatchObject({ revision: "current", mode: "summary", personalText: "Síntese atual" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("uses unsaved personal fields with current memories, without changing saved sources", async () => {
    const response = await POST(request({ query: "Perfil", draft: { contextAboutUser: "Rascunho atual" } }));
    const body = await response.json(); expect(body.mode).toBe("originals");
    expect(body.personalText).toContain("Rascunho atual"); expect(body.personalText).toContain("Memória ativa"); expect(body.personalText).not.toContain("Perfil salvo");
  });
  it("rejects stale retrieved content after source deletion or change", async () => {
    mocks.search.mockResolvedValue([{ sourceId: "memory:deleted", offset: 0, text: "Excluída" }, { sourceId: "memory:1", offset: 0, text: "Conteúdo anterior" }]);
    const body = await (await POST(request({ query: "detalhe" }))).json(); expect(body.details).toEqual([]);
  });
  it("schedules manual regeneration without waiting for the provider", async () => {
    expect((await POST(request({ regenerate: true }))).status).toBe(202); expect(mocks.schedule).toHaveBeenCalledWith(true);
  });
  it.each([{ query: 2 }, { draft: { contextAboutUser: 4 } }, { draft: { unknown: "field" } }, null])("rejects malformed input", async body => {
    expect((await POST(request(body))).status).toBe(400);
  });
});
