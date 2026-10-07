import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAppAuth: vi.fn(),
  readDiscoverState: vi.fn(),
  nextDiscoverScheduledAt: vi.fn(),
}));

vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.requireAppAuth }));
vi.mock("@/lib/discover/store", () => ({ readDiscoverState: mocks.readDiscoverState }));
vi.mock("@/lib/discover/schedule", () => ({ nextDiscoverScheduledAt: mocks.nextDiscoverScheduledAt }));

describe("GET /api/discover", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAppAuth.mockResolvedValue(null);
    mocks.readDiscoverState.mockResolvedValue({
      topics: [], articles: [], job: { status: "idle" }, schedule: { enabled: true }, lastDailyDate: "2026-10-05",
    });
    mocks.nextDiscoverScheduledAt.mockReturnValue("2026-10-07T11:00:00.000Z");
  });

  it("expõe o agendamento persistido e a próxima execução", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/discover"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      schedule: { enabled: true },
      nextScheduledAt: "2026-10-07T11:00:00.000Z",
    });
  });
});
