import { describe, expect, it } from "vitest";
import { normalizePulseTaskInput } from "./store";

const baseInput = {
  title: "Radar semanal",
  prompt: "Pesquise novidades.",
  recurrenceType: "weekly",
  time: "09:00",
  weekday: 1,
};

describe("Pulse task model selection", () => {
  it("defaults new tasks to GPT-6.1 Sol", () => {
    expect(normalizePulseTaskInput(baseInput).model).toBe("gpt-6.1-sol");
  });

  it.each(["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna", "gpt-5.6-sol"] as const)(
    "accepts %s as a premium Pulse model",
    (model) => {
      expect(normalizePulseTaskInput({ ...baseInput, model }).model).toBe(model);
    }
  );

  it("maps persisted model ids and rejects unknown models", () => {
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-terra" }).model).toBe("gpt-6.1-sol");
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-6-sol" }).model).toBe("gpt-6.1-sol");
    expect(normalizePulseTaskInput({ ...baseInput, model: "grok-4.7" }).model).toBe("gpt-6-luna");
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-5.4-mini" }).model).toBe("gpt-6-luna");
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-luna" }).model).toBe("gpt-6-luna");
    expect(() => normalizePulseTaskInput({ ...baseInput, model: "unknown" }))
      .toThrow("Modelo Pulse invalido");
  });
});
