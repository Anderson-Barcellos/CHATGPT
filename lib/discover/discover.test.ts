import { describe, expect, it } from "vitest";
import { normalizeDrafts } from "./curator";
import { discoverDate, normalizeTopics } from "./store";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const ARTICLE = {
  title: "Novo modelo de IA publicado",
  summary: "A organização apresentou uma atualização com capacidades novas e limites documentados.",
  content: "A organização apresentou um modelo novo. Ele responde a uma demanda observada no setor.\n\nA documentação descreve suas capacidades e limites. A mudança interessa a equipes que avaliam o uso em produção.\n\nOs resultados divulgados ainda precisam ser acompanhados em usos independentes, mas a publicação oferece um ponto de partida para comparação e testes. O contexto importa para entender onde a novidade pode trazer valor real.",
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

  it("normaliza preferências e respeita o fuso da atualização diária", () => {
    expect(normalizeTopics([" IA médica ", "ia médica", " Agentes  autônomos "])).toEqual(["IA médica", "Agentes autônomos"]);
    expect(() => normalizeTopics(["x"])).toThrow();
    expect(discoverDate(new Date("2026-10-04T02:00:00.000Z"))).toBe("2026-10-03");
  });
});
