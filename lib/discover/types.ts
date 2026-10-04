export interface DiscoverArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  publishedAt: string;
  createdAt: string;
  sources: { title: string; url: string }[];
  image?: string;
}

export interface DiscoverState {
  topics: string[];
  articles: DiscoverArticle[];
  job: {
    status: "idle" | "running" | "failed";
    startedAt?: string;
    finishedAt?: string;
    error?: string;
  };
  lastDailyDate?: string;
}

export const SUGGESTED_TOPICS = [
  "Modelos de linguagem",
  "Agentes",
  "IA médica",
  "Pesquisa em IA",
  "Ferramentas",
  "Segurança e regulação",
];
