import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePulseExecutionProfile } from "./config";

const ENV_KEYS = ["PULSE_RUN_MODEL", "PULSE_REASONING_EFFORT"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("Pulse execution profile", () => {
  it("roda rotina sem modelo salvo em GPT-6.1 Sol com reasoning medium", () => {
    expect(resolvePulseExecutionProfile({ model: undefined as never })).toEqual({
      model: "gpt-6.1-sol",
      reasoningEffort: "medium",
    });
  });

  it("preserva o modelo salvo na rotina", () => {
    expect(resolvePulseExecutionProfile({ model: "gpt-5.6-sol" })).toEqual({
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
    });
  });

  it("roda rotinas salvas com Grok ou mini no GPT-6 Luna", () => {
    expect(resolvePulseExecutionProfile({ model: "grok-4.7" })).toMatchObject({ model: "gpt-6-luna" });
    expect(resolvePulseExecutionProfile({ model: "gpt-5.4-mini" })).toMatchObject({ model: "gpt-6-luna" });
  });
});
