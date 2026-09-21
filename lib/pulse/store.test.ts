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

  it.each(["gpt-5.6-sol", "gpt-5.6-terra"] as const)(
    "accepts %s as a premium Pulse model",
    (model) => {
      expect(normalizePulseTaskInput({ ...baseInput, model }).model).toBe(model);
    }
  );

  it("rejects unsupported Pulse models", () => {
    expect(
      () => normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-luna" })
    ).toThrow("Modelo Pulse invalido");
  });
});
