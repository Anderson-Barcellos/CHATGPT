"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  LoaderCircle,
  Newspaper,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { useAssistantTts } from "@/hooks/useAssistantTts";
import {
  createPulseTask,
  deletePulseRun,
  deletePulseTask,
  listPulseRuns,
  listPulseTasks,
  proposePulseTask,
  readablePulseError,
  runPulseTaskNow,
  updatePulseTaskStatus,
} from "@/lib/pulse/pulseApi";
import type {
  PulseRecurrenceType,
  PulseRun,
  PulseTask,
  PulseTaskProposal,
} from "@/lib/pulse/types";
import { describeSchedule, weekdayOptions } from "@/lib/pulse/schedule";
import { derivePulseRunTitle } from "@/lib/pulse/runTitle";

const NEUROPSYCH_PRESET =
  "Semanalmente, encontre um artigo recente, importante e de alto impacto em neuropsiquiatria. Gere uma imagem inicial conceitual relacionada ao tema do artigo, como abertura visual. Em seguida, escreva uma revisão em português, em prosa técnico-narrativa, explicando o contexto, a pergunta científica, o desenho do estudo, os achados centrais, a relevância clínica/conceitual, as limitações e por que esse artigo merece atenção. Priorize artigos de periódicos fortes, acesso aberto quando possível, e inclua referências/citações das fontes usadas.";

const WEEKDAYS = weekdayOptions();

interface ProposalForm {
  title: string;
  emoji: string;
  prompt: string;
  executionPrompt: string;
  recurrenceType: PulseRecurrenceType;
  time: string;
  weekday: string;
  dayOfMonth: string;
}

function proposalToForm(proposal: PulseTaskProposal): ProposalForm {
  return {
    title: proposal.title,
    emoji: proposal.emoji,
    prompt: proposal.prompt,
    executionPrompt: proposal.executionPrompt,
    recurrenceType: proposal.recurrenceType,
    time: proposal.time || "09:00",
    weekday: String(proposal.weekday ?? 1),
    dayOfMonth: String(proposal.dayOfMonth ?? 1),
  };
}

function formatDateTime(value?: string): string {
  if (!value) return "sem horario";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sem horario";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function imageSrc(run: PulseRun): string | null {
  if (!run.imageBase64) return null;
  return `data:${run.imageMimeType || "image/png"};base64,${run.imageBase64}`;
}

function PulseTtsControls({ run }: { run: PulseRun }) {
  const tts = useAssistantTts(run.content, `pulse-${run.id}`);

  if (!run.content.trim()) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-2 py-1.5">
      <Button
        type="button"
        size="xs"
        variant="ghost"
        onClick={tts.togglePlay}
        className="h-7 rounded-md px-2 text-nano"
      >
        {tts.status === "loading" ? (
          <LoaderCircle className="size-3 animate-spin" />
        ) : tts.isPlaying ? (
          <Pause className="size-3" />
        ) : (
          <Volume2 className="size-3" />
        )}
        {tts.isPlaying ? "Pausar" : "Ouvir"}
      </Button>
      {tts.isOpen && (
        <>
          <span className="text-nano text-muted-foreground">
            {tts.formattedCurrentTime} / {tts.formattedDuration}
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => tts.seekBy(-15)}
            className="h-7 rounded-md px-2 text-nano"
          >
            -15s
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => tts.seekBy(15)}
            className="h-7 rounded-md px-2 text-nano"
          >
            +15s
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={tts.stop}
            className="h-7 rounded-md px-2 text-nano"
          >
            <X className="size-3" />
            Parar
          </Button>
        </>
      )}
      {tts.error && <span className="text-nano text-rose-600">{tts.error}</span>}
    </div>
  );
}

function PulseRunCard({
  run,
  isExpanded,
  onToggleExpanded,
  onDelete,
}: {
  run: PulseRun;
  isExpanded: boolean;
  onToggleExpanded: (runId: string) => void;
  onDelete: (run: PulseRun) => void;
}) {
  const src = imageSrc(run);
  const displayTitle = derivePulseRunTitle(run.content, run.title);
  const routineTitle = run.taskTitle ?? (run.content ? run.title : undefined);
  const shouldShowRoutineTitle =
    Boolean(routineTitle) && routineTitle !== displayTitle;
  const stopCardToggle = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => onToggleExpanded(run.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleExpanded(run.id);
        }
      }}
      className="gc-clinical-card cursor-pointer overflow-hidden rounded-2xl border border-[color:var(--gc-border)] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={`w-full object-cover transition-[height] ${
            isExpanded ? "h-40 md:h-52" : "h-24 md:h-32"
          }`}
        />
      ) : (
        <div
          className={`flex items-center justify-center bg-primary/10 text-primary transition-[height] ${
            isExpanded ? "h-28 md:h-40" : "h-20 md:h-24"
          }`}
        >
          <Sparkles className={isExpanded ? "size-8" : "size-6"} />
        </div>
      )}

      {shouldShowRoutineTitle && (
        <div className="border-y border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-1.5">
          <p className="truncate text-[10px] font-medium uppercase text-muted-foreground/75">
            Rotina · {routineTitle}
          </p>
        </div>
      )}

      <div className="min-w-0 p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-xs font-semibold text-foreground">
              {displayTitle}
            </h3>
            <p className="mt-1 text-nano text-muted-foreground">
              {run.status === "completed"
                ? `Concluido ${formatDateTime(run.completedAt)}`
                : run.status === "running"
                  ? "Executando agora"
                  : run.status === "failed"
                    ? "Falhou"
                    : "Na fila"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={`rounded-full px-2 py-1 text-nano ${
                run.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : run.status === "failed"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "bg-primary/10 text-primary"
              }`}
            >
              {run.status}
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                stopCardToggle(event);
                onDelete(run);
              }}
              aria-label={`Excluir geracao ${displayTitle}`}
              className="rounded-md text-rose-700 hover:text-rose-700 dark:text-rose-300"
            >
              <Trash2 className="size-3.5" />
            </Button>
            <ChevronDown
              className={`size-3.5 text-muted-foreground transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {run.status === "running" && (
          <p className="flex items-center gap-2 text-micro text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" />
            O Gaucho esta pesquisando, escrevendo e gerando a abertura visual.
          </p>
        )}

        {!isExpanded && run.error && (
          <p className="mb-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
            {run.error}
          </p>
        )}

        {!isExpanded && run.content && (
          <p className="line-clamp-3 text-nano leading-relaxed text-muted-foreground/85">
            {run.content}
          </p>
        )}

        {isExpanded && (
          <div className="mt-3 border-t border-[color:var(--gc-border-soft)] pt-3">
            {run.error && (
            <p className="mb-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
              {run.error}
            </p>
            )}

            {run.content && (
              <ChatMarkdown
                content={run.content}
                className="text-micro leading-relaxed md:text-xs"
              />
            )}

            {run.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {run.citations.slice(0, 5).map((citation) => (
                  <a
                    key={citation.url}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-full border border-[color:var(--gc-border-soft)] px-2 py-1 text-nano text-primary hover:bg-primary/10"
                  >
                    {citation.title || "Fonte"}
                  </a>
                ))}
              </div>
            )}

            <div onClick={(event) => event.stopPropagation()}>
              <PulseTtsControls run={run} />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function PulseActivityPanelV2() {
  const [runs, setRuns] = useState<PulseRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(
    () => new Set()
  );

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRuns(await listPulseRuns());
    } catch (error) {
      setLoadError(readablePulseError(error, "Nao consegui carregar as geracoes Pulse."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
    const interval = window.setInterval(() => void loadRuns(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadRuns]);

  const handleToggleExpanded = useCallback((runId: string) => {
    setExpandedRunIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }, []);

  const handleDeleteRun = useCallback(
    async (run: PulseRun) => {
      const displayTitle = derivePulseRunTitle(run.content, run.title);
      const shouldDelete = window.confirm(
        `Excluir a geracao "${displayTitle || "Pulse"}"?`
      );
      if (!shouldDelete) return;

      try {
        await deletePulseRun(run.id);
        setExpandedRunIds((current) => {
          const next = new Set(current);
          next.delete(run.id);
          return next;
        });
        toast.success("Geracao Pulse removida.");
        await loadRuns();
      } catch (error) {
        toast.error(readablePulseError(error, "Nao consegui remover essa geracao."));
      }
    },
    [loadRuns]
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Newspaper className="size-3.5 text-primary" />
          Ultimas geracoes Pulse
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-nano text-muted-foreground">{runs.length}</span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={() => void loadRuns()}
            disabled={isLoading}
            aria-label="Atualizar geracoes Pulse"
            className="size-[var(--gc-mobile-icon-button-size)] rounded-md md:size-6"
          >
            <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loadError && (
        <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {loadError}
        </p>
      )}

      {runs.length > 0 ? (
        runs.slice(0, 12).map((run) => (
          <PulseRunCard
            key={run.id}
            run={run}
            isExpanded={expandedRunIds.has(run.id)}
            onToggleExpanded={handleToggleExpanded}
            onDelete={handleDeleteRun}
          />
        ))
      ) : (
        <p className="rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
          As execucoes automaticas vao aparecer aqui.
        </p>
      )}
    </section>
  );
}

function PulseTaskCard({
  task,
  isRunning,
  isExpanded,
  onRun,
  onToggleStatus,
  onToggleExpanded,
  onDelete,
}: {
  task: PulseTask;
  isRunning: boolean;
  isExpanded: boolean;
  onRun: (taskId: string) => void;
  onToggleExpanded: (taskId: string) => void;
  onToggleStatus: (task: PulseTask) => void;
  onDelete: (taskId: string) => void;
}) {
  const stopCardToggle = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => onToggleExpanded(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleExpanded(task.id);
        }
      }}
      className="gc-clinical-row cursor-pointer rounded-2xl border border-[color:var(--gc-border-soft)] p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{task.emoji}</span>
            <h3 className="truncate text-xs font-semibold text-foreground">
              {task.title}
            </h3>
          </div>
          <p className="mt-1 flex items-center gap-1 text-nano text-muted-foreground">
            <CalendarClock className="size-3" />
            {describeSchedule(task.schedule)} · proxima {formatDateTime(task.nextRunAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={`rounded-full px-2 py-1 text-nano ${
              task.status === "active"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {task.status === "active" ? "ativa" : "pausada"}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={(event) => {
              stopCardToggle(event);
              onDelete(task.id);
            }}
            aria-label={`Excluir rotina ${task.title}`}
            className="rounded-md text-rose-700 hover:text-rose-700 dark:text-rose-300"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 border-t border-[color:var(--gc-border-soft)] pt-3">
          <p className="text-nano leading-relaxed text-muted-foreground/85">
            {task.prompt}
          </p>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={(event) => {
                stopCardToggle(event);
                onToggleStatus(task);
              }}
              className="h-7 rounded-md px-2 text-nano"
            >
              {task.status === "active" ? (
                <Pause className="size-3" />
              ) : (
                <Play className="size-3" />
              )}
              {task.status === "active" ? "Pausar" : "Ativar"}
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={(event) => {
                stopCardToggle(event);
                onRun(task.id);
              }}
              disabled={isRunning}
              className="h-7 rounded-md px-2 text-nano"
            >
              {isRunning ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Rodar agora
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

export function PulsePanelV2() {
  const [tasks, setTasks] = useState<PulseTask[]>([]);
  const [runs, setRuns] = useState<PulseRun[]>([]);
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<PulseTaskProposal | null>(null);
  const [form, setForm] = useState<ProposalForm | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const runningTaskIds = useMemo(
    () => new Set(runs.filter((run) => run.status === "running").map((run) => run.taskId)),
    [runs]
  );

  const loadPulse = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextTasks, nextRuns] = await Promise.all([
        listPulseTasks(),
        listPulseRuns(),
      ]);
      setTasks(nextTasks);
      setRuns(nextRuns);
    } catch (error) {
      setLoadError(readablePulseError(error, "Nao consegui carregar o Pulse."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPulse();
    const interval = window.setInterval(() => void loadPulse(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadPulse]);

  useEffect(() => {
    const handleDraft = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      if (detail?.text) {
        setPrompt(detail.text);
        setProposal(null);
        setForm(null);
      }
    };

    window.addEventListener("gaucho:pulse-draft-from-text", handleDraft);
    return () => {
      window.removeEventListener("gaucho:pulse-draft-from-text", handleDraft);
    };
  }, []);

  const handlePropose = useCallback(async () => {
    if (!prompt.trim()) {
      toast.info("Escreve a rotina antes de pedir para o Gaucho interpretar.");
      return;
    }

    setIsProposing(true);
    try {
      const nextProposal = await proposePulseTask(prompt);
      setProposal(nextProposal);
      setForm(proposalToForm(nextProposal));
      toast.success(
        nextProposal.canCreate
          ? "Rotina interpretada. Revisa e confirma."
          : "Faltam dados; completa os campos antes de salvar."
      );
    } catch (error) {
      toast.error(readablePulseError(error, "Nao consegui interpretar essa rotina."));
    } finally {
      setIsProposing(false);
    }
  }, [prompt]);

  const handleCreate = useCallback(async () => {
    if (!form) return;
    setIsCreating(true);
    try {
      await createPulseTask({
        title: form.title,
        emoji: form.emoji,
        prompt: form.prompt,
        executionPrompt: form.executionPrompt,
        recurrenceType: form.recurrenceType,
        time: form.time,
        weekday: Number(form.weekday),
        dayOfMonth: Number(form.dayOfMonth),
      });
      setPrompt("");
      setProposal(null);
      setForm(null);
      toast.success("Rotina Pulse criada.");
      await loadPulse();
    } catch (error) {
      toast.error(readablePulseError(error, "Nao consegui criar a rotina Pulse."));
    } finally {
      setIsCreating(false);
    }
  }, [form, loadPulse]);

  const handleRun = useCallback(
    async (taskId: string) => {
      setRunningTaskId(taskId);
      try {
        await runPulseTaskNow(taskId);
        toast.success("Execucao Pulse concluida.");
        await loadPulse();
      } catch (error) {
        toast.error(readablePulseError(error, "Nao consegui rodar essa rotina."));
        await loadPulse();
      } finally {
        setRunningTaskId(null);
      }
    },
    [loadPulse]
  );

  const handleToggleStatus = useCallback(
    async (task: PulseTask) => {
      try {
        await updatePulseTaskStatus(
          task.id,
          task.status === "active" ? "paused" : "active"
        );
        await loadPulse();
      } catch (error) {
        toast.error(readablePulseError(error, "Nao consegui atualizar a rotina."));
      }
    },
    [loadPulse]
  );

  const handleToggleExpanded = useCallback((taskId: string) => {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      const shouldDelete = window.confirm(
        `Excluir a rotina "${task?.title || "Pulse"}"?`
      );
      if (!shouldDelete) return;

      try {
        await deletePulseTask(taskId);
        setExpandedTaskIds((current) => {
          const next = new Set(current);
          next.delete(taskId);
          return next;
        });
        toast.success("Rotina Pulse removida.");
        await loadPulse();
      } catch (error) {
        toast.error(readablePulseError(error, "Nao consegui remover a rotina."));
      }
    },
    [loadPulse, tasks]
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-[var(--gc-mobile-panel-content-gap)] p-[var(--gc-mobile-panel-content-pad)]">
        <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Nova rotina Pulse
              </h3>
              <p className="mt-1 text-nano text-muted-foreground">
                Descreve uma tarefa recorrente; o Gaucho extrai a agenda.
              </p>
            </div>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => void loadPulse()}
              disabled={isLoading}
              aria-label="Atualizar Pulse"
              className="rounded-md"
            >
              <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ex: Semanalmente, encontre um artigo recente..."
              className="min-h-28 rounded-md border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] text-xs"
            />
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setPrompt(NEUROPSYCH_PRESET)}
                className="h-7 rounded-md px-2 text-nano"
              >
                <Plus className="size-3" />
                Preset neuropsiquiatria
              </Button>
              <Button
                type="button"
                size="xs"
                onClick={() => void handlePropose()}
                disabled={isProposing}
                className="h-7 rounded-md px-2 text-nano"
              >
                {isProposing ? (
                  <LoaderCircle className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Interpretar
              </Button>
            </div>
          </div>

          {proposal && form && (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
              {!proposal.canCreate && proposal.missingFields.length > 0 && (
                <p className="flex gap-2 text-nano text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  Completa: {proposal.missingFields.join(", ")}.
                </p>
              )}

              <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
                <Input
                  value={form.emoji}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, emoji: event.target.value } : current
                    )
                  }
                  className="h-8 rounded-md text-center text-xs"
                />
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                  className="h-8 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1 text-nano text-muted-foreground">
                  <span>Frequencia</span>
                  <select
                    value={form.recurrenceType}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              recurrenceType: event.target.value as PulseRecurrenceType,
                            }
                          : current
                      )
                    }
                    className="h-8 w-full rounded-md border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-2 text-xs text-foreground"
                  >
                    <option value="daily">Diaria</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </label>
                <label className="block space-y-1 text-nano text-muted-foreground">
                  <span>Horario</span>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, time: event.target.value } : current
                      )
                    }
                    className="h-8 rounded-md text-xs"
                  />
                </label>
              </div>

              {form.recurrenceType === "weekly" && (
                <label className="block space-y-1 text-nano text-muted-foreground">
                  <span>Dia da semana</span>
                  <select
                    value={form.weekday}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, weekday: event.target.value } : current
                      )
                    }
                    className="h-8 w-full rounded-md border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-2 text-xs text-foreground"
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {form.recurrenceType === "monthly" && (
                <label className="block space-y-1 text-nano text-muted-foreground">
                  <span>Dia do mes</span>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, dayOfMonth: event.target.value } : current
                      )
                    }
                    className="h-8 rounded-md text-xs"
                  />
                </label>
              )}

              <Textarea
                value={form.executionPrompt}
                onChange={(event) =>
                  setForm((current) =>
                    current
                      ? { ...current, executionPrompt: event.target.value }
                      : current
                  )
                }
                className="min-h-20 rounded-md text-xs"
              />

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="xs"
                  onClick={() => void handleCreate()}
                  disabled={isCreating}
                  className="h-7 rounded-md px-2 text-nano"
                >
                  {isCreating ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  Criar rotina
                </Button>
              </div>
            </div>
          )}
        </section>

        {loadError && (
          <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {loadError}
          </p>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">Rotinas</h3>
            <span className="text-nano text-muted-foreground">{tasks.length}</span>
          </div>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <PulseTaskCard
                key={task.id}
                task={task}
                isExpanded={expandedTaskIds.has(task.id)}
                isRunning={runningTaskId === task.id || runningTaskIds.has(task.id)}
                onRun={handleRun}
                onToggleExpanded={handleToggleExpanded}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <p className="rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
              Nenhuma rotina Pulse ainda.
            </p>
          )}
        </section>

      </div>
    </ScrollArea>
  );
}
