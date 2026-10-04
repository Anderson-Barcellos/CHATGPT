import OpenAI from "openai";
import { extractResponseOutput } from "@/lib/chat/responseToMessagePatch";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import type { DiscoverArticle } from "./types";

type Draft = Omit<DiscoverArticle, "id" | "createdAt" | "image">;

const DISCOVER_SCHEMA = {
  type: "json_schema" as const,
  name: "gaucho_discover_articles",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["articles"],
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "content", "topic", "publishedAt", "sources"],
          properties: {
            title: { type: "string" }, summary: { type: "string" }, content: { type: "string" },
            topic: { type: "string" }, publishedAt: { type: "string" },
            sources: { type: "array", items: { type: "object", additionalProperties: false,
              required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } } },
          },
        },
      },
    },
  },
};

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

function normalizeDrafts(text: string, citedUrls: string[], today = new Date()): Draft[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed: unknown = JSON.parse(cleaned);
  const raw = Array.isArray(parsed) ? parsed : (parsed as { articles?: unknown })?.articles;
  if (!Array.isArray(raw)) throw new Error("A curadoria não retornou uma lista de matérias.");
  const citations = new Set(citedUrls.map((url) => httpUrl(url)).filter(Boolean));
  if (!citations.size) throw new Error("A busca não retornou fontes verificáveis.");
  const seen = new Set<string>();
  const drafts: Draft[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const article = candidate as Record<string, unknown>;
    const title = typeof article.title === "string" ? article.title.trim() : "";
    const summary = typeof article.summary === "string" ? article.summary.trim() : "";
    const content = typeof article.content === "string" ? article.content.trim() : "";
    const topic = typeof article.topic === "string" ? article.topic.trim() : "IA";
    const publishedAt = typeof article.publishedAt === "string" ? article.publishedAt : "";
    const published = new Date(publishedAt);
    const age = today.getTime() - published.getTime();
    if (!title || title.length > 160 || summary.length < 30 || summary.length > 500 || content.length < 250 ||
      !Number.isFinite(age) || age < -24 * 60 * 60 * 1000 || age > 14 * 24 * 60 * 60 * 1000) continue;
    const sources = Array.isArray(article.sources) ? article.sources.flatMap((source: unknown) => {
      if (!source || typeof source !== "object") return [];
      const item = source as Record<string, unknown>;
      const url = httpUrl(item.url);
      if (!url || !citations.has(url)) return [];
      return [{ title: typeof item.title === "string" ? item.title.slice(0, 140) : new URL(url).hostname, url }];
    }) : [];
    if (!sources.length || seen.has(sources[0].url)) continue;
    seen.add(sources[0].url);
    const paragraphs = content.split(/\n\s*\n/);
    const citedContent = paragraphs.map((paragraph, index) => {
      if (/\]\(https?:\/\//.test(paragraph)) return paragraph;
      const source = sources[Math.min(index, sources.length - 1)];
      return `${paragraph} [Fonte: ${source.title}](${source.url})`;
    }).join("\n\n");
    drafts.push({ title, summary, content: citedContent, topic: topic.slice(0, 60), publishedAt: published.toISOString(), sources });
    if (drafts.length === 5) break;
  }
  if (!drafts.length) throw new Error("Nenhuma matéria recente com fonte citada passou pela curadoria.");
  return drafts;
}

async function generateCover(client: OpenAI, article: Draft): Promise<string | undefined> {
  const response = await client.responses.create({
    model: "gpt-6-luna",
    instructions: "Gere só uma ilustração editorial para uma notícia. Sem texto, letras, logos ou rostos identificáveis.",
    input: `Manchete: ${article.title}\nResumo: ${article.summary}`,
    reasoning: { effort: "low" },
    max_output_tokens: 1200,
    tools: [{ type: "image_generation", model: "gpt-image-2", quality: "low", size: "auto", background: "auto", output_format: "png" }],
  });
  return extractResponseOutput(response).imageBase64;
}

export async function curateDiscoverArticles(topics: string[], previous: DiscoverArticle[], now = new Date()): Promise<Omit<DiscoverArticle, "id" | "createdAt">[]> {
  const client = createOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY indisponível para a curadoria.");
  const response = await client.responses.create({
    model: "gpt-6-sol",
    reasoning: { effort: "medium" },
    max_output_tokens: 16000,
    text: { format: DISCOVER_SCHEMA },
    include: ["web_search_call.action.sources"],
    tools: [{ type: "web_search_preview", search_context_size: "medium", user_location: { type: "approximate", country: "BR" } }],
    instructions: [
      "És editor de um feed pessoal de notícias de inteligência artificial.",
      "Pesquise na web fatos publicados nos últimos 14 dias. Priorize fontes primárias e independentes confiáveis.",
      "Retorne até 5 itens em articles. Cada item tem title, summary, content, topic, publishedAt ISO e sources [{title,url}].",
      "Cada notícia deve ter data e ao menos uma URL efetivamente consultada na busca. Não invente fatos, datas ou URLs.",
      "Escreva em português brasileiro: resumo claro e narrativa interessante, factual, em 3 a 5 parágrafos curtos em Markdown, com contexto, novidade e implicação.",
      "Não repita o mesmo acontecimento nem notícias já publicadas. Inclua novidades gerais relevantes e priorize os assuntos pessoais quando houver.",
      "Insira links Markdown para as fontes junto às afirmações no content. Não inclua texto protegido de matérias; sintetize com palavras próprias.",
    ].join("\n"),
    input: [
      `Data atual: ${now.toISOString()}. Assuntos preferidos: ${topics.join(", ") || "nenhum"}.`,
      `Manchetes anteriores a evitar: ${previous.slice(0, 30).map((item) => item.title).join(" | ") || "nenhuma"}.`,
    ].join("\n"),
  });
  if (response.status !== "completed") throw new Error("A busca terminou sem resposta completa.");
  const output = extractResponseOutput(response);
  const searchSources = (response.output as Array<{ type?: string; action?: { sources?: Array<{ url?: string }> } }>)
    .filter((item) => item.type === "web_search_call")
    .flatMap((item) => item.action?.sources?.map((source) => source.url).filter((url): url is string => typeof url === "string") ?? []);
  const drafts = normalizeDrafts(response.output_text || output.content, [...output.citations.map((citation) => citation.url), ...searchSources], now);
  const previousSources = new Set(previous.map((item) => item.sources[0]?.url));
  const fresh = drafts.filter((item) => !previousSources.has(item.sources[0]?.url));
  if (!fresh.length) {
    if (previous.length) return [];
    throw new Error("Nenhuma notícia recente passou pela curadoria inicial.");
  }
  const articles: Omit<DiscoverArticle, "id" | "createdAt">[] = [];
  for (const article of fresh) {
    let image: string | undefined;
    try { image = await generateCover(client, article); }
    catch (error) { console.warn("[discover] Capa indisponível:", error instanceof Error ? error.message : "erro"); }
    articles.push({ ...article, ...(image ? { image } : {}) });
  }
  return articles;
}

export { normalizeDrafts };
