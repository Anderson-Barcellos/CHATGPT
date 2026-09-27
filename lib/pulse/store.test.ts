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
  it("defaults new tasks to Grok 4.7", () => {
    expect(normalizePulseTaskInput(baseInput).model).toBe("grok-4.7");
  });

  it.each(["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"] as const)(
    "accepts %s as a premium Pulse model",
    (model) => {
      expect(normalizePulseTaskInput({ ...baseInput, model }).model).toBe(model);
    }
  );

  it("maps persisted model ids and rejects unknown models", () => {
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-terra" }).model).toBe("gpt-6-sol");
    expect(normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-luna" }).model).toBe("gpt-6-luna");
    expect(() => normalizePulseTaskInput({ ...baseInput, model: "unknown" }))
      .toThrow("Modelo Pulse invalido");
  });
});
