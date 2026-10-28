"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Newspaper, Plus, RefreshCw, Sparkles, Trash2, Volume2, X } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { MiniAudioPlayer } from "@/components/chat/MiniAudioPlayer";
import { ProductNav } from "@/components/navigation/ProductNav";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiUrl } from "@/lib/utils";
import type { DiscoverState } from "@/lib/discover/types";
import { MOBILE_MEDIA_QUERY } from "@/lib/layout/breakpoints";

type ViewState = DiscoverState & {
  suggestedTopics: string[];
  schedule?: { enabled: boolean };
  nextScheduledAt?: string | null;
};

interface ScheduleUpdateResponse {
  schedule: { enabled: boolean };
  nextScheduledAt: string | null;
}

interface DiscoverRefreshResponse {
  status?: "started" | "running" | "completed" | "failed";
}

interface DiscoverFeedProps {
  embedded?: boolean;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Não foi possível carregar o feed.");
  return body as T;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatScheduledAt(value: string | null | undefined): string {
  if (!value) return "A próxima data será calculada na reativação.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previsão indisponível.";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function DiscoverFeed({ embedded = false }: DiscoverFeedProps) {
  const [state, setState] = useState<ViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [audioArticleId, setAudioArticleId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<{ id: string; title: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const deleteInFlight = useRef(false);
  const selectionButton = useRef<HTMLButtonElement>(null);
  const articleRefs = useRef(new Map<string, HTMLElement>());
  const pendingMutations = useRef(0);
  const readVersion = useRef(0);

  const beginMutation = useCallback(() => {
    pendingMutations.current += 1;
    readVersion.current += 1;
  }, []);

  const finishMutation = useCallback(() => {
    pendingMutations.current = Math.max(0, pendingMutations.current - 1);
    readVersion.current += 1;
  }, []);

  const load = useCallback(async () => {
    const requestVersion = readVersion.current;
    try {
      const data = await responseJson<ViewState>(await fetch(apiUrl("/api/discover"), { cache: "no-store" }));
      if (requestVersion !== readVersion.current || pendingMutations.current > 0) return;
      setState(data);
      setError("");
    } catch (cause) {
      if (requestVersion !== readVersion.current || pendingMutations.current > 0) return;
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o feed.");
    } finally {
      if (requestVersion === readVersion.current && pendingMutations.current === 0) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestVersion = readVersion.current;
    fetch(apiUrl("/api/discover"), { cache: "no-store", signal: controller.signal })
      .then(responseJson<ViewState>)
      .then((data) => {
        if (!controller.signal.aborted && requestVersion === readVersion.current && pendingMutations.current === 0) {
          setState(data);
          setError("");
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted && requestVersion === readVersion.current && pendingMutations.current === 0) {
          setError(cause instanceof Error ? cause.message : "Falha ao carregar o feed.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestVersion === readVersion.current && pendingMutations.current === 0) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (state?.job.status !== "running") return;
    const interval = window.setInterval(() => { void load(); }, 4000);
    return () => window.clearInterval(interval);
  }, [state?.job.status, load]);

  const saveTopics = async (topics: string[]) => {
    beginMutation();
    setSaving(true);
    try {
      const result = await responseJson<{ topics: string[] }>(await fetch(apiUrl("/api/discover/topics"), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topics }),
      }));
      setState((current) => current ? { ...current, topics: result.topics } : current);
      setDraft("");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar assuntos."); }
    finally {
      finishMutation();
      setSaving(false);
    }
  };

  const saveSchedule = async (enabled: boolean) => {
    if (savingSchedule) return;
    beginMutation();
    setSavingSchedule(true);
    try {
      const result = await responseJson<ScheduleUpdateResponse>(await fetch(apiUrl("/api/discover/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }));
      setState((current) => current ? {
        ...current,
        schedule: result.schedule,
        nextScheduledAt: result.nextScheduledAt,
      } : current);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar a atualização automática.");
    } finally {
      finishMutation();
      setSavingSchedule(false);
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      const result = await responseJson<DiscoverRefreshResponse>(await fetch(apiUrl("/api/discover/refresh"), { method: "POST" }));
      if (result.status === "started" || result.status === "running") {
        setState((current) => current ? {
          ...current,
          job: { ...current.job, status: "running" },
        } : current);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao iniciar atualização.");
    } finally {
      setRefreshing(false);
    }
  };

  const busy = state?.job.status === "running";
  const selectedArticles = state?.articles.filter((article) => selected.includes(article.id)) ?? [];
  const requestDelete = (targets: { id: string; title: string }[]) => {
    setDeleteError("");
    setDeleteTargets(targets.map(({ id, title }) => ({ id, title })));
  };
  const deleteArticles = async () => {
    if (deleteInFlight.current || !deleteTargets.length) return;
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError("");
    beginMutation();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await responseJson<{ deletedIds: string[] }>(await fetch(apiUrl("/api/discover"), {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deleteTargets.map((article) => article.id) }), signal: controller.signal,
      }));
      const removed = new Set(result.deletedIds);
      setState((current) => current ? { ...current, articles: current.articles.filter((article) => !removed.has(article.id)) } : current);
      setSelected((current) => current.filter((id) => !removed.has(id)));
      setAudioArticleId((current) => current && removed.has(current) ? null : current);
      setExpanded((current) => current && removed.has(current) ? null : current);
      setNotice(removed.size === 1 ? "Notícia apagada." : `${removed.size} notícias apagadas.`);
      setDeleteTargets([]);
    } catch (cause) {
      setDeleteError(cause instanceof DOMException && cause.name === "AbortError"
        ? "A resposta demorou demais. Confere a seleção e tenta novamente."
        : cause instanceof Error ? cause.message : "Não foi possível apagar as notícias.");
    } finally {
      clearTimeout(timeout);
      finishMutation();
      setDeleting(false);
      deleteInFlight.current = false;
    }
  };
  const scheduleEnabled = state?.schedule?.enabled;
  const toggleArticle = (id: string, open: boolean) => {
    const next = open ? null : id;
    setExpanded(next);
    if (!next || embedded || window.matchMedia(MOBILE_MEDIA_QUERY).matches) return;
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      articleRefs.current.get(id)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const automaticSchedule = (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3" aria-label="Atualização automática">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Atualização automática <span className={scheduleEnabled === undefined ? "text-muted-foreground" : scheduleEnabled ? "text-primary" : "text-muted-foreground"}>{scheduleEnabled === undefined ? "Carregando…" : scheduleEnabled ? "Ativa" : "Pausada"}</span></p>
        <p className="mt-0.5 text-xs text-muted-foreground">{scheduleEnabled === undefined ? "Carregando a preferência de atualização automática…" : <>A cada dois dias, às 08h (São Paulo) · {scheduleEnabled ? `Próxima previsão: ${formatScheduledAt(state?.nextScheduledAt)}` : "Pausada até tu reativar."}</>}</p>
        {savingSchedule && <p className="mt-1 text-xs font-medium text-primary" aria-live="polite">Salvando preferência…</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-label="Atualização automática"
        aria-checked={Boolean(scheduleEnabled)}
        disabled={savingSchedule || loading || !state}
        onClick={() => void saveSchedule(!scheduleEnabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${scheduleEnabled ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`size-5 rounded-full bg-background shadow-sm transition-transform ${scheduleEnabled ? "translate-x-6" : "translate-x-1"}`} />
        <span className="sr-only">{savingSchedule ? "Salvando atualização automática" : scheduleEnabled ? "Pausar atualização automática" : "Ativar atualização automática"}</span>
      </button>
    </section>
  );

  const topicPreferences = (
    <div className="rounded-2xl border border-border bg-card p-5">
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
  );

  return (
    <div
      data-discover-scroll-root
      className={`gc-chat-ui touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground ${embedded ? "flex min-h-0 flex-1 flex-col" : "h-dvh"}`}
    >
      {!embedded && <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <Link href="/" aria-label="Voltar ao Chat" className="rounded-lg p-2 hover:bg-accent"><ArrowLeft className="size-5" /></Link>
          <div className="mr-auto flex min-w-0 items-center gap-2 font-semibold"><Newspaper className="size-5 shrink-0 text-primary" /> <span className="truncate">Descobrir IA</span></div>
          <ProductNav active="discover" compact className="ml-auto max-[430px]:w-full max-[430px]:justify-center" />
        </div>
      </header>}
      <main className={embedded ? "w-full p-[var(--gc-mobile-panel-content-pad)]" : "mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_17rem] md:px-6"}>
        <section className="min-w-0">
          <div className={`${embedded ? "mb-5" : "mb-7"} flex flex-wrap items-end justify-between gap-4`}>
            <div>{!embedded && <p className="text-xs font-semibold uppercase tracking-widest text-primary">Curadoria para Anders</p>}
              <h1 className={`font-semibold tracking-tight ${embedded ? "text-body-sm" : "mt-1 text-3xl md:text-4xl"}`}>{embedded ? "Novidades em IA" : "O que está acontecendo em IA"}</h1>
              {!embedded && <p className="mt-2 text-sm text-muted-foreground">Novidades com contexto, leitura leve e fontes para ir além.</p>}
            </div>
            <button type="button" onClick={() => void refresh()} disabled={busy || loading || refreshing || deleting}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border font-medium hover:bg-accent disabled:opacity-50 ${embedded ? "px-2 text-xs" : "px-4 text-sm"}`}>
              <RefreshCw className={`size-4 ${busy || refreshing ? "animate-spin" : ""}`} />{busy || refreshing ? "Atualizando…" : "Buscar novidades"}
            </button>
          </div>
          {embedded ? (
            <Collapsible className="group mb-5 rounded-2xl border border-border bg-card" defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold hover:bg-accent/60">
                  Preferências do feed
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-4">
                <div className="space-y-4">
                  {automaticSchedule}
                  {topicPreferences}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : <div className="mb-5">{automaticSchedule}</div>}
          {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{notice}</p>}
          <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Gerenciar notícias">
            <button ref={selectionButton} type="button" aria-pressed={selecting} disabled={loading || deleting}
              onClick={() => { setSelecting(!selecting); setSelected([]); }} className="min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-accent disabled:opacity-50">
              {selecting ? "Cancelar seleção" : "Selecionar notícias"}
            </button>
            {selecting && <>
              <button type="button" disabled={deleting || !state?.articles.length} onClick={() => setSelected(selectedArticles.length === state?.articles.length ? [] : state?.articles.map((article) => article.id) ?? [])}
                className="min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-accent disabled:opacity-50">{selectedArticles.length > 0 && selectedArticles.length === state?.articles.length ? "Desmarcar todas" : "Selecionar todas"}</button>
              <button type="button" disabled={busy || deleting || !selectedArticles.length} onClick={() => requestDelete(selectedArticles)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-destructive/40 px-3 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="size-4" />Apagar selecionadas ({selectedArticles.length})</button>
            </>}
            {busy && <p className="w-full text-xs text-muted-foreground">Aguarde a atualização terminar para apagar notícias.</p>}
          </div>
          {state?.job.status === "failed" && <p role="status" className="mb-4 rounded-xl border border-amber-500/40 p-3 text-sm">A última atualização falhou: {state.job.error}. As matérias anteriores seguem disponíveis.</p>}
          {loading && !state && <p role="status" className="py-16 text-center text-muted-foreground">Carregando notícias…</p>}
          {!loading && state?.articles.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><Sparkles className="mx-auto mb-3 size-7 text-primary" /><p className="font-medium">O feed ainda está vazio.</p><p className="mt-1 text-sm text-muted-foreground">Busca as primeiras novidades para começar.</p></div>}
          <div className={`grid ${embedded ? "gap-[var(--gc-mobile-panel-content-gap)]" : "gap-5 md:grid-cols-2"}`}>
            {state?.articles.map((article) => {
              const open = expanded === article.id;
              return <article key={article.id} ref={(node) => { if (node) articleRefs.current.set(article.id, node); else articleRefs.current.delete(article.id); }}
                data-discover-article={article.id}
                className={`min-w-0 scroll-mt-20 overflow-hidden rounded-2xl border shadow-sm ${embedded ? "gc-clinical-card border-[color:var(--gc-border)]" : "border-border bg-card"} ${open && !embedded ? "md:order-first md:col-span-2" : ""}`}>
                {article.image ? (
                  // A capa privada requer cookie e vem da rota autenticada do app.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apiUrl(`/api/discover/images/${article.image}`)} alt="" loading="lazy" decoding="async" className={`w-full object-cover ${embedded ? (open ? "h-28 md:h-40" : "h-20 md:h-24") : (open ? "h-52 md:h-72" : "h-40")}`} />
                )
                  : <div className={`flex items-center justify-center bg-primary/10 text-primary ${embedded ? (open ? "h-28 md:h-40" : "h-20 md:h-24") : (open ? "h-52" : "h-40")}`}><Sparkles className={embedded ? "size-6" : "size-10"} /></div>}
                {embedded && <div className="border-y border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-1.5"><p className="truncate text-nano font-medium uppercase text-muted-foreground/75">IA · {article.topic}</p></div>}
                <div className={embedded ? "min-w-0 p-3" : "p-5"}>
                  {embedded && <div className="mb-2 flex items-start justify-between gap-2">
                    <button type="button" aria-expanded={open} aria-controls={`discover-${article.id}`} onClick={() => toggleArticle(article.id, open)} className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary">
                      <span className="min-w-0 flex-1"><span role="heading" aria-level={2} className="line-clamp-2 text-caption font-semibold text-foreground">{article.title}</span><span className="mt-1 block text-micro text-muted-foreground">{formatDate(article.publishedAt)}</span></span>
                      <ChevronDown className={`mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    <button type="button" aria-label={`Apagar notícia: ${article.title}`} disabled={busy || deleting} onClick={() => requestDelete([article])} className="flex size-11 shrink-0 items-center justify-center rounded-md text-rose-700 hover:bg-destructive/10 disabled:opacity-50 dark:text-rose-300"><Trash2 className="size-3.5" /></button>
                  </div>}
                  {(!embedded || selecting) && <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {selecting && <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-primary" aria-label={`Selecionar notícia: ${article.title}`} disabled={deleting}
                        checked={selected.includes(article.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, article.id] : current.filter((id) => id !== article.id))} />Selecionar
                    </label>}
                    {!embedded && <button type="button" aria-label={`Apagar notícia: ${article.title}`} disabled={busy || deleting} onClick={() => requestDelete([article])}
                      className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><Trash2 className="size-4" />Apagar</button>}
                  </div>
                  </div>}
                  {!embedded && <><p className="text-xs font-semibold uppercase tracking-wide text-primary">{article.topic} · {formatDate(article.publishedAt)}</p>
                  <h2 className="mt-2 text-xl font-semibold leading-tight">{article.title}</h2></>}
                  {(!embedded || !open) && <p className={embedded ? "line-clamp-3 text-caption leading-relaxed text-muted-foreground/85" : "mt-3 text-sm leading-relaxed text-muted-foreground"}>{article.summary}</p>}
                  {(!embedded || open) && <>
                  <button type="button" onClick={() => setAudioArticleId(article.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent">
                    <Volume2 className="size-4" /> Ouvir matéria
                  </button>
                  {!embedded && <button type="button" aria-expanded={open} aria-controls={`discover-${article.id}`} onClick={() => toggleArticle(article.id, open)}
                    className="ml-3 mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg font-medium text-primary hover:underline">
                    {open ? "Recolher" : "Ler a matéria"}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>}
                  </>}
                  {audioArticleId === article.id && (
                    <MiniAudioPlayer
                      content={`${article.title}\n\n${article.content}`}
                      messageId={`discover-${article.id}`}
                      allowRealtime={false}
                      onClose={() => setAudioArticleId(null)}
                    />
                  )}
                  {open && <div id={`discover-${article.id}`} className="mt-4 border-t border-border pt-5">
                    <ChatMarkdown content={article.content} className={embedded ? "text-caption leading-relaxed md:text-caption" : "leading-relaxed"} />
                    <h3 className="mt-6 text-sm font-semibold">Fontes</h3>
                    <ul className="mt-2 space-y-2">{article.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-primary underline">{source.title || source.url}</a></li>)}</ul>
                  </div>}
                </div>
              </article>;
            })}
          </div>
        </section>
        {!embedded && <aside className="min-w-0 md:pt-24">
          <div className="md:sticky md:top-24">{topicPreferences}</div>
        </aside>}
      </main>
      <Dialog open={deleteTargets.length > 0} onOpenChange={(open) => { if (!open && !deleteInFlight.current) setDeleteTargets([]); }}>
        <DialogContent data-discover-confirmation showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); selectionButton.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{deleteTargets.length === 1 ? "Apagar esta notícia?" : `Apagar ${deleteTargets.length} notícias?`}</DialogTitle>
            <DialogDescription>As notícias serão removidas deste feed. Uma curadoria futura pode encontrar a mesma fonte novamente.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 space-y-2 overflow-y-auto break-words text-sm">{deleteTargets.map((article) => <li key={article.id}>{article.title}</li>)}</ul>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <button type="button" disabled={deleting} onClick={() => setDeleteTargets([])} className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-50">Cancelar</button>
            <button type="button" disabled={deleting} onClick={() => void deleteArticles()} className="min-h-11 rounded-lg bg-destructive px-4 text-sm text-white disabled:opacity-50">{deleting ? "Apagando…" : "Confirmar exclusão"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DiscoverPage() {
  return <DiscoverFeed />;
}
