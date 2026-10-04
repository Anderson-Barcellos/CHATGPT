import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/discover/runner", () => ({ runDiscover: vi.fn().mockResolvedValue("not_due") }));

afterEach(() => vi.unstubAllEnvs());

describe("agendador Descobrir IA", () => {
  it("recusa configuração ausente e Bearer incorreto", async () => {
    vi.stubEnv("DISCOVER_RUNNER_TOKEN", "");
    expect((await POST(new NextRequest("http://localhost/api/discover/run-due", { method: "POST" }))).status).toBe(503);
    vi.stubEnv("DISCOVER_RUNNER_TOKEN", "segredo-sintetico");
    expect((await POST(new NextRequest("http://localhost/api/discover/run-due", { method: "POST", headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });

  it("aceita o token e relata que a rodada não está pendente", async () => {
    vi.stubEnv("DISCOVER_RUNNER_TOKEN", "segredo-sintetico");
    const response = await POST(new NextRequest("http://localhost/api/discover/run-due", {
      method: "POST", headers: { authorization: "Bearer segredo-sintetico" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "not_due" });
  });
});
