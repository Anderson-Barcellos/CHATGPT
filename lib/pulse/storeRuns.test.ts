import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PulseRun, PulseTask } from "@/lib/pulse/types";

const files = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@/lib/server/jsonFileStore", () => {
  const chains = new Map<string, Promise<unknown>>();
  return {
    readDataFile: async <T,>(name: string, fallback: T) =>
      (files.has(name) ? structuredClone(files.get(name)) : fallback) as T,
    writeDataFile: async (name: string, value: unknown) => {
      files.set(name, structuredClone(value));
    },
    withDataFileLock: async <T,>(name: string, fn: () => Promise<T>) => {
      const previous = chains.get(name) ?? Promise.resolve();
      const next = previous.then(fn, fn);
      chains.set(name, next.catch(() => undefined));
      return next;
    },
  };
});

import { createPulseRun, recoverOrphanedPulseRuns } from "@/lib/pulse/store";

const task = {
  id: "task-1",
  title: "Radar",
  model: "grok-4.7",
} as PulseTask;

function runs(): PulseRun[] {
  return (files.get("pulse-runs.json") as PulseRun[]) ?? [];
}

beforeEach(() => {
  files.clear();
});

describe("Pulse run claim and recovery", () => {
  it("claims a run atomically: a concurrent second claim for the same task gets null", async () => {
    const [first, second] = await Promise.all([
      createPulseRun(task),
      createPulseRun(task),
    ]);
    const claimed = [first, second].filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect(runs().filter((run) => run.status === "running")).toHaveLength(1);
  });

  it("allows a new claim once the previous run is no longer running", async () => {
    const first = await createPulseRun(task);
    files.set("pulse-runs.json", runs().map((run) => ({ ...run, status: "completed" })));
    const second = await createPulseRun(task);
    expect(first?.id).toBeTruthy();
    expect(second?.id).toBeTruthy();
    expect(second?.id).not.toBe(first?.id);
  });

  it("fails running runs that no live process owns and keeps the owned one", async () => {
    const orphan = await createPulseRun({ ...task, id: "task-orphan" });
    const owned = await createPulseRun({ ...task, id: "task-owned" });
    const recovered = await recoverOrphanedPulseRuns(new Set([owned!.id]));
    expect(recovered.map((run) => run.id)).toEqual([orphan!.id]);
    const byId = new Map(runs().map((run) => [run.id, run]));
    expect(byId.get(orphan!.id)).toMatchObject({
      status: "failed",
      error: expect.stringContaining("reinício"),
    });
    expect(byId.get(orphan!.id)?.completedAt).toBeTruthy();
    expect(byId.get(owned!.id)?.status).toBe("running");
  });
});
