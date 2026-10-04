"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Newspaper, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { ProductNav } from "@/components/navigation/ProductNav";
import { apiUrl } from "@/lib/utils";
import type { DiscoverState } from "@/lib/discover/types";

type ViewState = DiscoverState & { suggestedTopics: string[] };

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Não foi possível carregar o feed.");
  return body as T;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DiscoverPage() {
  const [state, setState] = useState<ViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await responseJson<ViewState>(await fetch(apiUrl("/api/discover"), { cache: "no-store" }));
      setState(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o feed.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl("/api/discover"), { cache: "no-store", signal: controller.signal })
      .then(responseJson<ViewState>)
      .then((data) => { setState(data); setError(""); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao carregar o feed."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (state?.job.status !== "running") return;
    const interval = window.setInterval(() => { void load(); }, 4000);
    return () => window.clearInterval(interval);
  }, [state?.job.status, load]);

  const saveTopics = async (topics: string[]) => {
    setSaving(true);
    try {
      const result = await responseJson<{ topics: string[] }>(await fetch(apiUrl("/api/discover/topics"), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics }),
      }));
      setState((current) => current ? { ...current, topics: result.topics } : current);
      setDraft("");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar assuntos."); }
    finally { setSaving(false); }
  };

  const refresh = async () => {
    setError("");
    try {
      await responseJson(await fetch(apiUrl("/api/discover/refresh"), { method: "POST" }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao iniciar atualização."); }
  };

  const busy = state?.job.status === "running";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <Link href="/" aria-label="Voltar ao Chat" className="rounded-lg p-2 hover:bg-accent"><ArrowLeft className="size-5" /></Link>
          <div className="mr-auto flex items-center gap-2 font-semibold"><Newspaper className="size-5 text-primary" /> Descobrir IA</div>
          <ProductNav active="discover" compact />
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_17rem] md:px-6">
        <section className="min-w-0">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Curadoria para Anders</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">O que está acontecendo em IA</h1>
              <p className="mt-2 text-sm text-muted-foreground">Novidades com contexto, leitura leve e fontes para ir além.</p>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={busy || loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50">
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Atualizando…" : "Buscar novidades"}
            </button>
          </div>
          {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
          {state?.job.status === "failed" && <p role="status" className="mb-4 rounded-xl border border-amber-500/40 p-3 text-sm">A última atualização falhou: {state.job.error}. As matérias anteriores seguem disponíveis.</p>}
          {loading && !state && <p role="status" className="py-16 text-center text-muted-foreground">Carregando notícias…</p>}
          {!loading && state?.articles.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Sparkles className="mx-auto mb-3 size-7 text-primary" /><p className="font-medium">O feed ainda está vazio.</p><p className="mt-1 text-sm text-muted-foreground">Busca as primeiras novidades para começar.</p></div>}
          <div className="grid gap-5 sm:grid-cols-2">
            {state?.articles.map((article) => {
              const open = expanded === article.id;
              return <article key={article.id} className={`min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${open ? "sm:col-span-2" : ""}`}>
                {article.image ? (
                  // A capa privada requer cookie e vem da rota autenticada do app.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apiUrl(`/api/discover/images/${article.image}`)} alt="" loading="lazy" decoding="async" className={`w-full object-cover ${open ? "h-52 md:h-72" : "h-40"}`} />
                )
                  : <div className={`flex items-center justify-center bg-primary/10 text-primary ${open ? "h-52" : "h-40"}`}><Sparkles className="size-10" /></div>}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{article.topic} · {formatDate(article.publishedAt)}</p>
                  <h2 className="mt-2 text-xl font-semibold leading-tight">{article.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
                  <button type="button" aria-expanded={open} aria-controls={`discover-${article.id}`} onClick={() => setExpanded(open ? null : article.id)}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg font-medium text-primary hover:underline">
                    {open ? "Recolher" : "Ler a matéria"}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && <div id={`discover-${article.id}`} className="mt-4 border-t border-border pt-5">
                    <ChatMarkdown content={article.content} className="leading-relaxed" />
                    <h3 className="mt-6 text-sm font-semibold">Fontes</h3>
                    <ul className="mt-2 space-y-2">{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline">{source.title || source.url}</a></li>)}</ul>
                  </div>}
                </div>
              </article>;
            })}
          </div>
        </section>
        <aside className="min-w-0 md:pt-24">
          <div className="rounded-2xl border border-border bg-card p-5 md:sticky md:top-24">
            <h2 className="text-lg font-semibold">Teus assuntos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Eles ganham prioridade na próxima curadoria. IA geral continua no feed.</p>
            <div className="mt-4 flex flex-wrap gap-2">{state?.topics.map((topic) => <button key={topic} type="button" disabled={saving} onClick={() => void saveTopics(state.topics.filter((item) => item !== topic))} title={`Remover ${topic}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 px-3 text-xs text-primary hover:bg-primary/20">{topic}<X className="size-3" /></button>)}</div>
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (state && draft.trim()) void saveTopics([...state.topics, draft]); }}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={60} placeholder="Outro assunto" aria-label="Novo assunto" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
              <button type="submit" disabled={saving || !draft.trim()} aria-label="Adicionar assunto" className="min-h-10 min-w-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Plus className="mx-auto size-4" /></button>
            </form>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestões</p>
            <div className="mt-2 flex flex-wrap gap-2">{state?.suggestedTopics.filter((topic) => !state.topics.includes(topic)).map((topic) => <button key={topic} type="button" disabled={saving} onClick={() => void saveTopics([...state.topics, topic])} className="min-h-9 rounded-full border border-border px-3 text-xs hover:bg-accent">+ {topic}</button>)}</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
