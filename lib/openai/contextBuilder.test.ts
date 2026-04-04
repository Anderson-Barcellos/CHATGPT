import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";

describe("buildSystemPrompt", () => {
  it("includes base instructions, response preferences and active memories", () => {
    const result = buildSystemPrompt(
      "Sempre responda em PT-BR.",
      {
        id: "default",
        contextAboutUser: "Anders é radiologista.",
        responsePreferences: "Prefira explicações narrativas.",
      },
      [
        {
          id: "mem-1",
          content: "Gosta de respostas diretas.",
          category: "preferences",
          isActive: true,
          priority: 10,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ]
    );

    expect(result.systemMessage).toContain("Sempre responda em PT-BR.");
    expect(result.systemMessage).toContain("Anders é radiologista.");
    expect(result.systemMessage).toContain("Prefira explicações narrativas.");
    expect(result.systemMessage).toContain("Gosta de respostas diretas.");
    expect(result.injectedMemories).toHaveLength(1);
  });
});
