import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPulseTaskFromText } from "./extractTask";

const originalModel = process.env.PULSE_EXTRACT_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.PULSE_EXTRACT_MODEL;
  else process.env.PULSE_EXTRACT_MODEL = originalModel;
});

describe("extração de rotina Pulse com Grok", () => {
  it("resolve o override legado para Grok medium com saída estruturada", async () => {
    process.env.PULSE_EXTRACT_MODEL = "gpt-5.4-mini";
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        canCreate: true,
        missingFields: [],
        confidence: "high",
        title: "Radar semanal",
        emoji: "📡",
        prompt: "Faça um radar",
        executionPrompt: "Pesquise novidades e resuma.",
        recurrenceType: "weekly",
        time: "09:00",
        weekday: 1,
        dayOfMonth: 0,
      }),
    });
    const client = { responses: { create } } as unknown as OpenAI;

    const proposal = await extractPulseTaskFromText({
      text: "Toda segunda às 9 faça um radar",
      now: "2026-09-21T12:00:00.000Z",
    }, client);

    expect(proposal).toMatchObject({
      canCreate: true,
      title: "Radar semanal",
      recurrenceType: "weekly",
      time: "09:00",
      weekday: 1,
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "grok-4.7",
      reasoning: { effort: "medium" },
      text: { format: expect.objectContaining({ name: "pulse_task_from_text" }) },
    }));
  });

  it("recusa override de provider incompatível sem chamar o modelo", async () => {
    process.env.PULSE_EXTRACT_MODEL = "gpt-5.6-luna";
    const create = vi.fn();
    const client = { responses: { create } } as unknown as OpenAI;

    await expect(extractPulseTaskFromText({ text: "Todo dia às 9" }, client))
      .rejects.toMatchObject({ code: "pulse_task_model_not_supported" });
    expect(create).not.toHaveBeenCalled();
  });
});
