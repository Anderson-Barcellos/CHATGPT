import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAppAuth: vi.fn(),
  readDiscoverState: vi.fn(),
  saveDiscoverSchedule: vi.fn(),
  nextDiscoverScheduledAt: vi.fn(),
}));

vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/discover/store", () => ({
  readDiscoverState: mocks.readDiscoverState,
  saveDiscoverSchedule: mocks.saveDiscoverSchedule,
}));
vi.mock("@/lib/discover/schedule", () => ({ nextDiscoverScheduledAt: mocks.nextDiscoverScheduledAt }));

describe("PUT /api/discover/settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
    mocks.saveDiscoverSchedule.mockResolvedValue({ enabled: false });
    mocks.readDiscoverState.mockResolvedValue({ lastDailyDate: "2026-10-05" });
    mocks.nextDiscoverScheduledAt.mockReturnValue(null);
  });

  it("persiste a pausa e devolve a previsão atualizada", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(new NextRequest("http://localhost/api/discover/settings", {
      method: "PUT", body: JSON.stringify({ enabled: false }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.saveDiscoverSchedule).toHaveBeenCalledWith(false);
    await expect(response.json()).resolves.toEqual({ schedule: { enabled: false }, nextScheduledAt: null });
  });

  it("rejeita valores que não sejam booleanos", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(new NextRequest("http://localhost/api/discover/settings", {
      method: "PUT", body: JSON.stringify({ enabled: "false" }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.saveDiscoverSchedule).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ code: "discover_schedule_invalid" });
  });

  it("não confirma sucesso nem expõe o erro quando a persistência falha", async () => {
    mocks.saveDiscoverSchedule.mockRejectedValueOnce(new Error("falha de I/O em /dados/segredo"));
    const { PUT } = await import("./route");
    const response = await PUT(new NextRequest("http://localhost/api/discover/settings", {
      method: "PUT", body: JSON.stringify({ enabled: false }),
    }));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toEqual({
      error: "Discover schedule update failed",
      message: "Não foi possível atualizar o agendamento. Tente novamente.",
      code: "discover_schedule_update_failed",
    });
    expect(JSON.stringify(payload)).not.toContain("/dados/segredo");
  });
});
