import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import { curateDiscoverArticles } from "./curator";

vi.mock("@/lib/server/chatRequest", () => ({ createOpenAIClient: vi.fn() }));

const ARTICLE = {
  title: "Modelo de teste publicado",
  summary: "Esta manchete sintética descreve uma publicação de teste com contexto e fontes.",
  content: "Uma organização publicou uma novidade técnica para avaliação. O anúncio descreve capacidades e limites que merecem atenção.\n\nEquipes podem comparar resultados em seus próprios cenários antes de adotar a ferramenta. A documentação ajuda a separar promessa e medição.\n\nO contexto mais amplo inclui outras abordagens recentes e questões ainda abertas. Este texto é uma fixture sintética de integração da curadoria.",
  topic: "Modelos de linguagem",
  publishedAt: "2026-10-03T10:00:00.000Z",
  sources: [{ title: "Fonte de teste", url: "https://example.org/ia/modelo" }],
};

beforeEach(() => vi.resetAllMocks());

describe("integração da curadoria", () => {
  it("aceita URL consultada pela busca, gera capa e insere citação inline", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ status: "completed", output_text: JSON.stringify({ articles: [ARTICLE] }), output: [
        { type: "web_search_call", action: { sources: [{ url: ARTICLE.sources[0].url }] } },
      ] })
      .mockResolvedValueOnce({ status: "completed", output: [{ type: "image_generation_call", result: "imagem-base64" }] });
    vi.mocked(createOpenAIClient).mockReturnValue({ responses: { create } } as never);
    const articles = await curateDiscoverArticles([], [], new Date("2026-10-04T12:00:00.000Z"));
    expect(articles).toHaveLength(1);
    expect(articles[0].image).toBe("imagem-base64");
    expect(articles[0].content).toContain("[Fonte: Fonte de teste](https://example.org/ia/modelo)");
    expect(create).toHaveBeenCalledTimes(2);
  });
});
