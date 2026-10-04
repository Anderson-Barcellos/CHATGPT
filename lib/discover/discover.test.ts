import { describe, expect, it } from "vitest";
import { normalizeDrafts } from "./curator";
import { discoverDate, normalizeTopics } from "./store";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const PARAGRAPH = "A organização apresentou uma mudança relevante para equipes que trabalham com inteligência artificial, explicou o contexto técnico da decisão e descreveu onde a novidade pode ser útil. O anúncio também delimita o que ainda depende de testes independentes, adoção gradual e comparação com alternativas disponíveis. Para quem avalia a tecnologia, esse contexto ajuda a separar uma capacidade demonstrada de uma promessa que ainda precisa amadurecer em condições reais de uso, custo, segurança e manutenção ao longo do tempo.";
const LONG_CONTENT = Array.from({ length: 6 }, (_, index) => `${PARAGRAPH} ${PARAGRAPH} Este é o trecho narrativo ${index + 1}, ligado ao anterior por uma progressão clara.`).join("\n\n");
const ARTICLE = {
  title: "Novo modelo de IA publicado",
  summary: "A organização apresentou uma atualização com capacidades novas e limites documentados.",
  content: LONG_CONTENT,
  topic: "Modelos de linguagem",
  publishedAt: "2026-10-03T10:00:00.000Z",
  sources: [{ title: "Publicação oficial", url: "https://example.org/news/model" }],
};

describe("curadoria do Descobrir IA", () => {
  it("aceita apenas matéria recente com URL citada pela busca", () => {
    const text = JSON.stringify({ articles: [ARTICLE, { ...ARTICLE, title: "Duplicada" }] });
    const accepted = normalizeDrafts(text, [ARTICLE.sources[0].url], NOW);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].content).toContain("[Fonte: Publicação oficial](https://example.org/news/model)");
    expect(() => normalizeDrafts(text, [], NOW)).toThrow(/fontes verificáveis/);
    expect(() => normalizeDrafts(text, ["https://other.example/news"], NOW)).toThrow(/Nenhuma matéria/);
  });

  it("descarta datas antigas e futuras", () => {
    const old = { ...ARTICLE, publishedAt: "2026-09-01T10:00:00.000Z" };
    expect(() => normalizeDrafts(JSON.stringify([old]), [ARTICLE.sources[0].url], NOW)).toThrow(/Nenhuma matéria/);
  });

  it("descarta narrativas curtas ou com menos de seis parágrafos", () => {
    const shortWords = { ...ARTICLE, content: Array.from({ length: 6 }, () => "Parágrafo curto sem profundidade suficiente.").join("\n\n") };
    const fewParagraphs = { ...ARTICLE, content: Array.from({ length: 5 }, () => PARAGRAPH.repeat(3)).join("\n\n") };
    expect(() => normalizeDrafts(JSON.stringify([shortWords]), [ARTICLE.sources[0].url], NOW)).toThrow(/Nenhuma matéria/);
    expect(() => normalizeDrafts(JSON.stringify([fewParagraphs]), [ARTICLE.sources[0].url], NOW)).toThrow(/Nenhuma matéria/);
  });

  it("normaliza preferências e respeita o fuso da atualização diária", () => {
    expect(normalizeTopics([" IA médica ", "ia médica", " Agentes  autônomos "])).toEqual(["IA médica", "Agentes autônomos"]);
    expect(() => normalizeTopics(["x"])).toThrow();
    expect(discoverDate(new Date("2026-10-04T02:00:00.000Z"))).toBe("2026-10-03");
  });
});
