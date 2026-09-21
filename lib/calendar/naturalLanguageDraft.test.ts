import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalendarDraftFromNaturalLanguage } from "./naturalLanguageDraft";

const originalModel = process.env.CALENDAR_DRAFT_MODEL;

afterEach(() => {
  if (originalModel === undefined) delete process.env.CALENDAR_DRAFT_MODEL;
  else process.env.CALENDAR_DRAFT_MODEL = originalModel;
});

describe("extração de agenda com Grok", () => {
  it("resolve o override legado para Grok medium com saída estruturada", async () => {
    process.env.CALENDAR_DRAFT_MODEL = "gpt-5.4-mini";
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        canDraft: false,
        missingFields: ["horário"],
        confidence: "low",
        summary: "Consulta",
        description: "",
        location: "",
        startDateTime: "",
        endDateTime: "",
        durationMinutes: 60,
      }),
    });
    const client = { responses: { create } } as unknown as OpenAI;

    await expect(createCalendarDraftFromNaturalLanguage({
      text: "Marque uma consulta amanhã",
      now: "2026-09-21T12:00:00.000Z",
    }, client)).rejects.toMatchObject({
      code: "calendar_draft_incomplete",
      missingFields: ["horário"],
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "grok-4.7",
      reasoning: { effort: "medium" },
      text: { format: expect.objectContaining({ name: "calendar_draft_from_text" }) },
    }));
  });

  it("recusa override de provider incompatível sem chamar o modelo", async () => {
    process.env.CALENDAR_DRAFT_MODEL = "gpt-5.6-luna";
    const create = vi.fn();
    const client = { responses: { create } } as unknown as OpenAI;

    await expect(createCalendarDraftFromNaturalLanguage({
      text: "Consulta amanhã às 10",
    }, client)).rejects.toMatchObject({ code: "calendar_draft_model_not_supported" });
    expect(create).not.toHaveBeenCalled();
  });
});
