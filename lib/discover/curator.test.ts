import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import { curateDiscoverArticles, rewriteDiscoverArticles } from "./curator";

vi.mock("@/lib/server/chatRequest", () => ({ createOpenAIClient: vi.fn() }));

const PARAGRAPH = "A organização apresentou uma mudança relevante para equipes que trabalham com inteligência artificial, explicou o contexto técnico da decisão e descreveu onde a novidade pode ser útil. O anúncio também delimita o que ainda depende de testes independentes, adoção gradual e comparação com alternativas disponíveis. Para quem avalia a tecnologia, esse contexto ajuda a separar uma capacidade demonstrada de uma promessa que ainda precisa amadurecer em condições reais de uso, custo, segurança e manutenção ao longo do tempo.";
const LONG_CONTENT = Array.from({ length: 6 }, (_, index) => `${PARAGRAPH} ${PARAGRAPH} Este é o trecho narrativo ${index + 1}, ligado ao anterior por uma progressão clara.`).join("\n\n");
const ARTICLE = {
  title: "Modelo de teste publicado",
  summary: "Esta manchete sintética descreve uma publicação de teste com contexto e fontes.",
  content: LONG_CONTENT,
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
    expect(create.mock.calls[0][0]).toMatchObject({
      model: "gpt-6.1-sol",
      reasoning: { effort: "medium" },
      text: { verbosity: "high" },
      tools: [expect.objectContaining({ type: "web_search_preview" })],
    });
    expect(create.mock.calls[0][0].instructions).toContain("6 a 9 parágrafos");
  });

  it("reescreve sem gerar capa e preserva a identidade da matéria", async () => {
    const current = {
      ...ARTICLE,
      id: "article-1",
      createdAt: "2026-10-04T12:00:00.000Z",
      image: "image-1",
    };
    const create = vi.fn().mockResolvedValue({
      status: "completed",
      output_text: JSON.stringify({ articles: [{ ...ARTICLE, content: `${LONG_CONTENT}\n\n${PARAGRAPH}` }] }),
      output: [{ type: "web_search_call", action: { sources: [{ url: ARTICLE.sources[0].url }] } }],
    });
    vi.mocked(createOpenAIClient).mockReturnValue({ responses: { create } } as never);

    const rewritten = await rewriteDiscoverArticles([current], new Date("2026-10-04T12:00:00.000Z"));

    expect(rewritten).toHaveLength(1);
    expect(rewritten[0]).toMatchObject({
      id: current.id,
      title: current.title,
      summary: current.summary,
      image: current.image,
      createdAt: current.createdAt,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      model: "gpt-6.1-sol",
      reasoning: { effort: "medium" },
      text: { verbosity: "high" },
    });
  });
});
