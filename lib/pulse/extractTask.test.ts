import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPulseTaskFromText } from "./extractTask";

const originalModel = process.env.PULSE_EXTRACT_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.PULSE_EXTRACT_MODEL;
  else process.env.PULSE_EXTRACT_MODEL = originalModel;
});

describe("extração de rotina Pulse com GPT-6 Luna", () => {
  it.each(["gpt-5.4-mini", "grok-4.7"])("resolve o override legado %s para Luna low com saída estruturada", async (legacy) => {
    process.env.PULSE_EXTRACT_MODEL = legacy;
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
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
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

  it("acusa a falta da chave OpenAI sem tentar outro provider", async () => {
    await expect(extractPulseTaskFromText({ text: "Todo dia às 9" }, null))
      .rejects.toMatchObject({ code: "pulse_task_openai_api_key_missing", status: 503 });
  });
});
