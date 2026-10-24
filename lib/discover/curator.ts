import OpenAI from "openai";
import { extractResponseOutput } from "@/lib/chat/responseToMessagePatch";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import type { DiscoverArticle } from "./types";

type Draft = Omit<DiscoverArticle, "id" | "createdAt" | "image">;

const MIN_NARRATIVE_PARAGRAPHS = 6;
const MIN_NARRATIVE_WORDS = 600;
const EDITORIAL_INSTRUCTIONS = [
  "És editor de um feed pessoal de notícias de inteligência artificial.",
  "Pesquise na web fatos publicados nos últimos 14 dias. Priorize fontes primárias e independentes confiáveis.",
  "Cada notícia deve ter data e ao menos uma URL efetivamente consultada na busca. Não invente fatos, datas ou URLs.",
  "Escreva em português brasileiro uma narrativa contínua, factual e agradável, com 6 a 9 parágrafos curtos e aproximadamente 700 a 1.000 palavras.",
  "Encadeie abertura, contexto, acontecimento, implicações práticas, limites e próximos movimentos com transições naturais.",
  "Use voz ativa e explique termos difíceis de modo acessível. Evite listas, subtítulos artificiais, repetição, tom promocional e frases telegráficas.",
  "Insira links Markdown para as fontes junto às afirmações no content. Não inclua texto protegido de matérias; sintetize com palavras próprias.",
] as const;

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

function narrativeParagraphs(content: string): string[] {
  return content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function narrativeWordCount(content: string): number {
  const plain = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#-]/g, " ")
    .trim();
  return plain ? plain.split(/\s+/u).length : 0;
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
    if (!title || title.length > 160 || summary.length < 30 || summary.length > 500 ||
      narrativeParagraphs(content).length < MIN_NARRATIVE_PARAGRAPHS || narrativeWordCount(content) < MIN_NARRATIVE_WORDS ||
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
    model: "gpt-6.1-sol",
    reasoning: { effort: "medium" },
    max_output_tokens: 24000,
    text: { format: DISCOVER_SCHEMA, verbosity: "high" },
    include: ["web_search_call.action.sources"],
    tools: [{ type: "web_search_preview", search_context_size: "medium", user_location: { type: "approximate", country: "BR" } }],
    instructions: [
      ...EDITORIAL_INSTRUCTIONS,
      "Retorne até 5 itens em articles. Cada item tem title, summary, content, topic, publishedAt ISO e sources [{title,url}].",
      "Não repita o mesmo acontecimento nem notícias já publicadas. Inclua novidades gerais relevantes e priorize os assuntos pessoais quando houver.",
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

function mergeSources(current: DiscoverArticle["sources"], additional: DiscoverArticle["sources"]): DiscoverArticle["sources"] {
  const merged: DiscoverArticle["sources"] = [];
  const seen = new Set<string>();
  for (const source of [...current, ...additional]) {
    const url = httpUrl(source.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push({ title: source.title || new URL(url).hostname, url });
  }
  return merged;
}

export async function rewriteDiscoverArticles(
  current: DiscoverArticle[],
  now = new Date()
): Promise<DiscoverArticle[]> {
  const client = createOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY indisponível para a reescrita.");
  const rewritten: DiscoverArticle[] = [];

  for (const article of current) {
    const response = await client.responses.create({
      model: "gpt-6.1-sol",
      reasoning: { effort: "medium" },
      max_output_tokens: 6000,
      text: { format: DISCOVER_SCHEMA, verbosity: "high" },
      include: ["web_search_call.action.sources"],
      tools: [{ type: "web_search_preview", search_context_size: "medium", user_location: { type: "approximate", country: "BR" } }],
      instructions: [
        ...EDITORIAL_INSTRUCTIONS,
        "Reescreva exatamente a matéria fornecida e retorne exatamente um item em articles.",
        "Mantenha a manchete, o assunto e a data fornecidos. Preserve as fontes existentes e só acrescente URLs efetivamente consultadas na busca.",
        "Cada item tem title, summary, content, topic, publishedAt ISO e sources [{title,url}].",
      ].join("\n"),
      input: [
        `Data atual: ${now.toISOString()}.`,
        `Manchete: ${article.title}`,
        `Resumo do card: ${article.summary}`,
        `Assunto: ${article.topic}`,
        `Data da publicação: ${article.publishedAt}`,
        `Fontes existentes: ${article.sources.map((source) => `${source.title}: ${source.url}`).join(" | ")}`,
      ].join("\n"),
    });
    if (response.status !== "completed") throw new Error(`A reescrita de ${article.id} terminou sem resposta completa.`);
    const output = extractResponseOutput(response);
    const searchSources = (response.output as Array<{ type?: string; action?: { sources?: Array<{ url?: string }> } }>)
      .filter((item) => item.type === "web_search_call")
      .flatMap((item) => item.action?.sources?.map((source) => source.url).filter((url): url is string => typeof url === "string") ?? []);
    const allowedSources = [...article.sources.map((source) => source.url), ...output.citations.map((citation) => citation.url), ...searchSources];
    const drafts = normalizeDrafts(response.output_text || output.content, allowedSources, now);
    if (drafts.length !== 1) throw new Error(`A reescrita de ${article.id} não retornou exatamente uma matéria válida.`);
    rewritten.push({
      ...article,
      content: drafts[0].content,
      sources: mergeSources(article.sources, drafts[0].sources),
    });
  }

  return rewritten;
}

export { MIN_NARRATIVE_PARAGRAPHS, MIN_NARRATIVE_WORDS, narrativeParagraphs, narrativeWordCount, normalizeDrafts };
