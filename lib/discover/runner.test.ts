import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimDiscoverJob: vi.fn(),
  finishDiscoverJob: vi.fn(),
  readDiscoverState: vi.fn(),
  curateDiscoverArticles: vi.fn(),
}));

vi.mock("./store", () => ({
  claimDiscoverJob: mocks.claimDiscoverJob,
  finishDiscoverJob: mocks.finishDiscoverJob,
  readDiscoverState: mocks.readDiscoverState,
}));
vi.mock("./curator", () => ({ curateDiscoverArticles: mocks.curateDiscoverArticles }));

describe("runner do Descobrir IA", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["paused", "not_due"] as const)("relata %s sem iniciar uma curadoria paga", async (claim) => {
    mocks.claimDiscoverJob.mockResolvedValue(claim);
    const { runDiscover } = await import("./runner");

    await expect(runDiscover("daily")).resolves.toBe(claim);
    expect(mocks.curateDiscoverArticles).not.toHaveBeenCalled();
    expect(mocks.readDiscoverState).not.toHaveBeenCalled();
    expect(mocks.finishDiscoverJob).not.toHaveBeenCalled();
  });
});
