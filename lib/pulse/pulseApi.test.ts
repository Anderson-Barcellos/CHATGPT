import { describe, expect, it, vi } from "vitest";
import type { PulseRun } from "@/lib/pulse/types";
import { waitForPulseRunCompletion } from "@/lib/pulse/pulseApi";

function run(status: PulseRun["status"]): PulseRun {
  return {
    id: "run-1", taskId: "task-1", status, title: "Radar", content: "",
    citations: [], createdAt: "0", updatedAt: "0",
  };
}

describe("waitForPulseRunCompletion", () => {
  it("polls until the run leaves the running state", async () => {
    const listRuns = vi.fn()
      .mockResolvedValueOnce([run("running")])
      .mockResolvedValueOnce([run("running")])
      .mockResolvedValueOnce([run("completed")]);
    const finished = await waitForPulseRunCompletion("run-1", {
      listRuns, intervalMs: 1, timeoutMs: 1000,
    });
    expect(finished?.status).toBe("completed");
    expect(listRuns).toHaveBeenCalledTimes(3);
  });

  it("gives up after the timeout and returns the last known run", async () => {
    const listRuns = vi.fn().mockResolvedValue([run("running")]);
    const finished = await waitForPulseRunCompletion("run-1", {
      listRuns, intervalMs: 1, timeoutMs: 10,
    });
    expect(finished?.status).toBe("running");
  });

  it("returns null when the run disappeared from the feed", async () => {
    const listRuns = vi.fn().mockResolvedValue([]);
    const finished = await waitForPulseRunCompletion("run-1", {
      listRuns, intervalMs: 1, timeoutMs: 10,
    });
    expect(finished).toBeNull();
  });
});
