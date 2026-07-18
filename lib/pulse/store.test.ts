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
  it("defaults existing and new tasks to GPT-5.4 mini", () => {
    expect(normalizePulseTaskInput(baseInput).model).toBe("gpt-5.4-mini");
  });

  it("accepts GPT-5.6 Terra as the experimental model", () => {
    expect(
      normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-terra" }).model
    ).toBe("gpt-5.6-terra");
  });

  it("rejects unsupported Pulse models", () => {
    expect(() =>
      normalizePulseTaskInput({ ...baseInput, model: "gpt-5.6-sol" })
    ).toThrow("Modelo Pulse invalido");
  });
});
