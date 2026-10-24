import { afterEach, describe, expect, it } from "vitest";
import { resolvePulseExecutionProfile } from "./config";
import type { PulseTask } from "./types";

const task = { model: "gpt-6.1-sol" } as PulseTask;
const originalModel = process.env.PULSE_RUN_MODEL;
const originalEffort = process.env.PULSE_REASONING_EFFORT;

afterEach(() => {
  if (originalModel === undefined) delete process.env.PULSE_RUN_MODEL;
  else process.env.PULSE_RUN_MODEL = originalModel;
  if (originalEffort === undefined) delete process.env.PULSE_REASONING_EFFORT;
  else process.env.PULSE_REASONING_EFFORT = originalEffort;
});

describe("Pulse execution profile", () => {
  it("uses the task model with medium reasoning by default", () => {
    delete process.env.PULSE_RUN_MODEL;
    delete process.env.PULSE_REASONING_EFFORT;

    expect(resolvePulseExecutionProfile(task)).toEqual({
      model: "gpt-6.1-sol",
      reasoningEffort: "medium",
    });
  });

  it("keeps environment overrides as the operational escape hatch", () => {
    process.env.PULSE_RUN_MODEL = "gpt-6-luna";
    process.env.PULSE_REASONING_EFFORT = "high";

    expect(resolvePulseExecutionProfile(task)).toEqual({
      model: "gpt-6-luna",
      reasoningEffort: "high",
    });
  });

  it("normalizes legacy task and environment models before execution", () => {
    delete process.env.PULSE_RUN_MODEL;
    expect(resolvePulseExecutionProfile({ model: "gpt-5.6-terra" })).toMatchObject({ model: "gpt-6.1-sol" });
    expect(resolvePulseExecutionProfile({ model: "gpt-6-sol" })).toMatchObject({ model: "gpt-6.1-sol" });
    process.env.PULSE_RUN_MODEL = "gpt-5.6-luna";
    expect(resolvePulseExecutionProfile(task)).toMatchObject({ model: "gpt-6-luna" });
  });

  it("keeps Astra at its fixed medium reasoning despite an override", () => {
    process.env.PULSE_REASONING_EFFORT = "high";
    delete process.env.PULSE_RUN_MODEL;
    expect(resolvePulseExecutionProfile({ model: "gpt-6-astra" })).toEqual({
      model: "gpt-6-astra",
      reasoningEffort: "medium",
    });
  });
});
