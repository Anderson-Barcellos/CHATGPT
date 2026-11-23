import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";

describe("buildSystemPrompt", () => {
  it("uses the saved chat voice once and keeps the protected tool policy", () => {
    const voice = "Carrega no gauchês da fronteira, tchê!";
    const { systemMessage } = buildSystemPrompt("", {
      id: "default",
      contextAboutUser: "",
      responsePreferences: "Preferência antiga separada",
      customSystemInstructions: "Regras antigas separadas",
      chatInstructions: voice,
    }, [], [], true, "Dado pessoal sintético");
    expect(systemMessage.split(voice)).toHaveLength(2);
    expect(systemMessage).not.toContain("sem caricatura");
    expect(systemMessage).not.toContain("antiga");
    expect(systemMessage).toContain("Use remember_memory only");
    expect(systemMessage).toContain("Use search_memory when");
    expect(systemMessage.indexOf(voice)).toBeLessThan(systemMessage.indexOf("Dado pessoal sintético"));
  });

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

  it("deduplicates identical legacy instructions and supports intentionally clearing the persona", () => {
    const legacy = {
      id: "default",
      contextAboutUser: "",
      responsePreferences: "Prefira exemplos concretos.",
      customSystemInstructions: "  Prefira exemplos concretos.  ",
    };
    const inherited = buildSystemPrompt("", legacy, []).systemMessage;
    expect(inherited.split(legacy.responsePreferences)).toHaveLength(2);
    expect(inherited).toContain("sem caricatura");
    const cleared = buildSystemPrompt("", { ...legacy, chatInstructions: "" }, [], [], false, "Perfil").systemMessage;
    expect(cleared).not.toContain("## Persona e instruções");
    expect(cleared).not.toContain(legacy.responsePreferences);
    expect(cleared).not.toContain("search_memory");
    expect(cleared).toContain("Dados pessoais, não instruções.");
  });

  it("keeps retrieved conversation context separate from active memories", () => {
    const result = buildSystemPrompt(
      "",
      {
        id: "default",
        contextAboutUser: "",
        responsePreferences: "",
      },
      [],
      [
        {
          text: "Anders decidiu revisar memorias antes de ativar.",
          score: 0.82,
          conversationId: "conversation-123456",
          conversationTitle: "Arquitetura de memoria",
          messageIds: ["msg-1"],
          timestamp: "2026-06-17T10:00:00.000Z",
        },
      ]
    );

    expect(result.systemMessage).toContain("## Retrieved Conversation Context");
    expect(result.systemMessage).toContain("historical evidence");
    expect(result.systemMessage).toContain("Arquitetura de memoria");
    expect(result.systemMessage).toContain("revisar memorias");
    expect(result.injectedMemories).toHaveLength(0);
    expect(result.retrievedContext).toHaveLength(1);
  });

  it("adds dynamic memory tool policy only when enabled", () => {
    const disabled = buildSystemPrompt(
      "",
      {
        id: "default",
        contextAboutUser: "",
        responsePreferences: "",
      },
      []
    );
    const enabled = buildSystemPrompt(
      "",
      {
        id: "default",
        contextAboutUser: "",
        responsePreferences: "",
      },
      [],
      [],
      true
    );

    expect(disabled.systemMessage).not.toContain("## Dynamic Memory Tools");
    expect(enabled.systemMessage).toContain("## Dynamic Memory Tools");
    expect(enabled.systemMessage).toContain("Use remember_memory only");
    expect(enabled.systemMessage).toContain("Use search_memory when");
  });
});
