"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpenText,
  Check,
  ClipboardList,
  Code,
  Copy,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  PanelRightClose,
  PlayCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import { downloadArtifactPDF } from "@/lib/export/artifactPdf";
import { getQuizSourceContent } from "@/lib/artifacts/quizArtifacts";
import { useArtifactSessionPersistence } from "@/hooks/useArtifactSessionPersistence";
import { useConversations } from "@/hooks/useConversations";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";
import { saveConversationWorkspace } from "@/lib/storage/conversations";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type {
  ConversationWorkspace,
  ConversationWorkspaceNotes,
  Message,
  QuizMessageArtifact,
} from "@/types";

type ActivityStatus = "done" | "running" | "warning" | "failed";

interface ActivityEvent {
  id: string;
  label: string;
  detail?: string;
  status: ActivityStatus;
  timestamp: Date;
}

interface NotesDraft {
  objective: string;
  body: string;
  nextStepsText: string;
}

const EMPTY_NOTES_DRAFT: NotesDraft = {
  objective: "",
  body: "",
  nextStepsText: "",
};

function HtmlPreview({ content }: { content: string }) {
  const srcDoc = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6; padding: 18px; max-width: 100%; overflow-x: auto;
    color: #d9e6ee; background: #0b1118;
  }
  pre { background: #121b25; padding: 12px; border-radius: 8px; overflow-x: auto; }
  code { background: #121b25; padding: 2px 6px; border-radius: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #263545; padding: 8px 12px; text-align: left; }
  th { background: #121b25; }
  img, svg { max-width: 100%; height: auto; }
  a { color: #67e8f9; }
  h1, h2, h3 { color: #f4fbff; margin: 16px 0 8px; }
</style>
</head><body>${content}</body></html>`;

  return (
    <iframe
      srcDoc={srcDoc}
      className="h-full w-full rounded-lg border border-white/8 bg-slate-950"
      title="HTML Preview"
      sandbox=""
    />
  );
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function toDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function truncateText(value: string, max = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function parseNextStepsText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function notesToDraft(notes: ConversationWorkspaceNotes | undefined): NotesDraft {
  if (!notes) return EMPTY_NOTES_DRAFT;

  return {
    objective: notes.objective ?? "",
    body: notes.body ?? "",
    nextStepsText: (notes.nextSteps ?? []).join("\n"),
  };
}

function buildActivityEvents(messages: Message[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const message of messages) {
    const messageTime = toDate(message.timestamp);

    if (message.role === "user") {
      events.push({
        id: `${message.id}:user-prompt`,
        label: "Prompt do usuário enviado",
        detail: truncateText(message.content),
        status: "done",
        timestamp: messageTime,
      });

      if (message.attachments?.length) {
        events.push({
          id: `${message.id}:user-attachments`,
          label: `${message.attachments.length} anexo(s) enviados`,
          detail: message.attachments.map((attachment) => attachment.name).join(", "),
          status: "done",
          timestamp: messageTime,
        });
      }

      continue;
    }

    const streamStatus = message.streamStatus ?? "completed";
    const assistantStatus: ActivityStatus =
      streamStatus === "failed"
        ? "failed"
        : streamStatus === "aborted"
          ? "warning"
          : streamStatus === "streaming"
            ? "running"
            : "done";

    const assistantLabel =
      streamStatus === "failed"
        ? "Resposta do assistente falhou"
        : streamStatus === "aborted"
          ? "Geração interrompida"
          : streamStatus === "streaming"
            ? "Resposta em geração"
            : "Resposta concluída";

    events.push({
      id: `${message.id}:assistant-status`,
      label: assistantLabel,
      detail: truncateText(message.content),
      status: assistantStatus,
      timestamp: messageTime,
    });

    if (message.reasoningStatus === "thinking") {
      events.push({
        id: `${message.id}:reasoning-thinking`,
        label: "Raciocínio em andamento",
        status: "running",
        timestamp: messageTime,
      });
    }

    if (
      message.reasoningStatus === "complete" ||
      message.reasoningText ||
      message.reasoningSummary
    ) {
      events.push({
        id: `${message.id}:reasoning-complete`,
        label: "Raciocínio consolidado",
        status: "done",
        timestamp: messageTime,
      });
    }

    if (message.citations?.length) {
      events.push({
        id: `${message.id}:citations`,
        label: `${message.citations.length} citação(ões) associadas`,
        status: "done",
        timestamp: messageTime,
      });
    }

    if (message.artifact) {
      events.push({
        id: `${message.id}:artifact`,
        label: `Artefato gerado: ${message.artifact.title}`,
        detail: message.artifact.summary,
        status: "done",
        timestamp: messageTime,
      });
    }
  }

  return [...events].sort(
    (left, right) => right.timestamp.getTime() - left.timestamp.getTime()
  );
}

function ActivityTimeline({
  title,
  events,
  compact = false,
}: {
  title: string;
  events: ActivityEvent[];
  compact?: boolean;
}) {
  const visibleEvents = compact ? events.slice(0, 5) : events;

  return (
    <section className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <span className="text-[10px] text-cyan-100/85">
          {events.length} evento(s)
        </span>
      </div>

      {visibleEvents.length > 0 ? (
        <div className="space-y-2">
          {visibleEvents.map((event) => {
            const icon =
              event.status === "failed" ? (
                <AlertTriangle className="size-3 text-rose-200" />
              ) : event.status === "warning" ? (
                <AlertTriangle className="size-3 text-amber-200" />
              ) : event.status === "running" ? (
                <PlayCircle className="size-3 text-cyan-100" />
              ) : (
                <Check className="size-3 text-emerald-200" />
              );

            const badgeClass =
              event.status === "failed"
                ? "bg-rose-300/20 text-rose-100"
                : event.status === "warning"
                  ? "bg-amber-300/20 text-amber-100"
                  : event.status === "running"
                    ? "bg-cyan-300/16 text-cyan-100"
                    : "bg-emerald-300/16 text-emerald-100";

            return (
              <div
                key={event.id}
                className="flex items-start justify-between gap-2 rounded-md border border-white/6 bg-black/20 px-2.5 py-2"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${badgeClass}`}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-foreground/90">{event.label}</p>
                    {event.detail && (
                      <p className="truncate text-[10px] text-muted-foreground/75">
                        {event.detail}
                      </p>
                    )}
                  </div>
                </div>
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {formatClock(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-white/8 bg-black/20 px-3 py-4 text-[11px] text-muted-foreground">
          Sem eventos ainda nesta conversa.
        </div>
      )}
    </section>
  );
}

function EmptyArtifactState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 p-4">
      <div className="max-w-[17rem] text-center">
        <p className="text-sm font-semibold text-foreground">Sem artefato disponível</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Gere um documento ou quiz para habilitar preview, fonte e exportações.
        </p>
      </div>
    </div>
  );
}

export function ContextPanelV2() {
  const queryClient = useQueryClient();
  const {
    activeArtifact,
    artifactMessageId,
    openArtifact,
    closeArtifact,
  } = useUIStore();
  const { activeConversationId, messages } = useChatStore();
  const { conversations = [] } = useConversations();

  const [copied, setCopied] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesDraft, setNotesDraft] = useState<NotesDraft>(EMPTY_NOTES_DRAFT);
  const previousConversationIdRef = useRef<string | null>(null);

  const persistArtifactSession = useArtifactSessionPersistence();

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      null,
    [activeConversationId, conversations]
  );

  const persistedNotes = activeConversation?.workspace?.notes;
  const notesUpdatedAtKey = persistedNotes?.updatedAt
    ? toDate(persistedNotes.updatedAt).toISOString()
    : "none";

  useEffect(() => {
    const currentConversationId = activeConversationId ?? null;

    if (previousConversationIdRef.current !== currentConversationId) {
      previousConversationIdRef.current = currentConversationId;
      setNotesDraft(notesToDraft(persistedNotes));
      setNotesDirty(false);
      return;
    }

    if (!notesDirty) {
      setNotesDraft(notesToDraft(persistedNotes));
    }
  }, [activeConversationId, notesDirty, notesUpdatedAtKey, persistedNotes]);

  const fallbackArtifactMessage = useMemo(
    () => [...messages].reverse().find((message) => message.artifact),
    [messages]
  );

  const effectiveArtifact = activeArtifact ?? fallbackArtifactMessage?.artifact ?? null;
  const effectiveArtifactMessageId = activeArtifact
    ? artifactMessageId
    : fallbackArtifactMessage?.id ?? null;

  const documentArtifact =
    effectiveArtifact?.kind === "document" ? effectiveArtifact : null;
  const quizArtifact = effectiveArtifact?.kind === "quiz" ? effectiveArtifact : null;
  const isQuizArtifact = quizArtifact !== null;

  const artifactTitle = effectiveArtifact?.title || "Sem artefato";
  const artifactContent = documentArtifact
    ? documentArtifact.content
    : quizArtifact
      ? getQuizSourceContent(quizArtifact.quiz)
      : "";
  const artifactSourceLanguage = documentArtifact
    ? documentArtifact.type === "html"
      ? "html"
      : "markdown"
    : "json";
  const canDownloadPdf = documentArtifact !== null;
  const artifactExtension = documentArtifact
    ? documentArtifact.type === "html"
      ? "html"
      : "md"
    : "json";
  const artifactFilename = effectiveArtifact
    ? `${artifactTitle.replace(/\s+/g, "_")}.${artifactExtension}`
    : "";
  const canvasDescription = effectiveArtifact
    ? isQuizArtifact
      ? "Quiz renderizado em uma area maior, com espaco para responder e revisar."
      : documentArtifact?.type === "html"
        ? "Preview HTML renderizado em uma area maior do workspace."
        : "Documento markdown renderizado com mais respiro para leitura e producao."
    : "Gere um documento, quiz ou resposta rica para abrir aqui como canvas.";

  const activityEvents = useMemo(() => buildActivityEvents(messages), [messages]);
  const latestEvent = activityEvents[0];
  const promptsCount = activityEvents.filter((event) =>
    event.id.includes(":user-prompt")
  ).length;
  const artifactsCount = activityEvents.filter((event) =>
    event.id.includes(":artifact")
  ).length;
  const citationEventsCount = activityEvents.filter((event) =>
    event.id.includes(":citations")
  ).length;

  const handleOpenFallbackArtifact = useCallback(() => {
    if (!fallbackArtifactMessage?.artifact) return;
    openArtifact(fallbackArtifactMessage.artifact, fallbackArtifactMessage.id);
  }, [fallbackArtifactMessage, openArtifact]);

  const handleQuizSessionChange = useCallback(
    async (session: QuizMessageArtifact["quiz"]["session"]) => {
      if (!effectiveArtifactMessageId || !quizArtifact) return;

      await persistArtifactSession(effectiveArtifactMessageId, {
        ...quizArtifact,
        quiz: {
          ...quizArtifact.quiz,
          session,
        },
      });
    },
    [effectiveArtifactMessageId, persistArtifactSession, quizArtifact]
  );

  const handleCopy = useCallback(async () => {
    if (!effectiveArtifact) {
      toast.info("Sem artefato para copiar nesta conversa.");
      return;
    }

    try {
      await navigator.clipboard.writeText(artifactContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Nao consegui copiar o artefato.");
    }
  }, [artifactContent, effectiveArtifact]);

  const handleDownload = useCallback(() => {
    if (!effectiveArtifact) {
      toast.info("Sem artefato para baixar nesta conversa.");
      return;
    }

    const mime = documentArtifact
      ? documentArtifact.type === "html"
        ? "text/html"
        : "text/markdown"
      : "application/json";
    const blob = new Blob([artifactContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${artifactTitle || "artefato"}.${artifactExtension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [
    artifactContent,
    artifactExtension,
    artifactTitle,
    documentArtifact,
    effectiveArtifact,
  ]);

  const handleDownloadPDF = useCallback(async () => {
    if (!documentArtifact) {
      toast.info("Somente documentos possuem exportação em PDF.");
      return;
    }

    try {
      await downloadArtifactPDF(artifactContent, {
        title: artifactTitle || "Documento",
        contentType: documentArtifact.type,
      });
    } catch (downloadError) {
      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Falha ao exportar o documento em PDF.";
      toast.error("PDF nao exportado", { description: message });
    }
  }, [artifactContent, artifactTitle, documentArtifact]);

  const handleSaveNotes = useCallback(async () => {
    if (!activeConversationId) {
      toast.error("Selecione uma conversa antes de salvar notas.");
      return;
    }

    const workspacePayload: ConversationWorkspace = {
      notes: {
        objective: notesDraft.objective.trim(),
        body: notesDraft.body.trim(),
        nextSteps: parseNextStepsText(notesDraft.nextStepsText),
        updatedAt: new Date(),
      },
    };

    setIsSavingNotes(true);

    try {
      await withConversationPersistenceRetry(() =>
        saveConversationWorkspace(activeConversationId, workspacePayload)
      );
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(activeConversationId),
      });
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      });
      setNotesDraft(notesToDraft(workspacePayload.notes));
      setNotesDirty(false);
      toast.success("Notas salvas na conversa.");
    } catch (error) {
      console.error("[ContextPanelV2] Falha ao salvar notas:", error);
      toast.error("Nao consegui salvar as notas agora.");
    } finally {
      setIsSavingNotes(false);
    }
  }, [activeConversationId, notesDraft, queryClient]);

  const updateNotesField = useCallback(
    (field: keyof NotesDraft, value: string) => {
      setNotesDraft((current) => ({ ...current, [field]: value }));
      setNotesDirty(true);
    },
    []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-3 xl:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Painel operacional</h2>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Contexto
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={closeArtifact}>
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <Tabs defaultValue="canvas" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/8 px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Workspace</h2>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                acompanhamento em tempo real
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" onClick={handleCopy}>
                {copied ? (
                  <Check className="size-4 text-emerald-300" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={handleDownload}>
                <Download className="size-4" />
              </Button>
            </div>
          </div>
          <TabsList className="w-full rounded-lg border border-white/8 bg-white/[0.03] p-1">
            <TabsTrigger value="canvas" className="h-7 rounded-md text-xs">
              Canvas
            </TabsTrigger>
            <TabsTrigger value="artifact" className="h-7 rounded-md text-xs">
              Artefato
            </TabsTrigger>
            <TabsTrigger value="activity" className="h-7 rounded-md text-xs">
              Atividade
            </TabsTrigger>
            <TabsTrigger value="notes" className="h-7 rounded-md text-xs">
              Notas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="canvas" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3">
              <section className="v2-canvas-surface rounded-xl border p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/14 text-cyan-700 dark:text-cyan-100">
                        <BookOpenText className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {effectiveArtifact ? artifactTitle : "Canvas Markdown"}
                        </h3>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Leitura expandida
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {canvasDescription}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={handleCopy}>
                      {copied ? (
                        <Check className="size-4 text-emerald-300" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                    {canDownloadPdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={handleDownloadPDF}
                      >
                        PDF
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[color:var(--v2-border-soft)] bg-[var(--v2-canvas-soft)] p-2">
                  {effectiveArtifact ? (
                    isQuizArtifact ? (
                      <QuizCanvas
                        artifact={quizArtifact}
                        onSessionChange={handleQuizSessionChange}
                      />
                    ) : documentArtifact?.type === "html" ? (
                      <div className="h-[min(72vh,680px)]">
                        <HtmlPreview content={artifactContent} />
                      </div>
                    ) : (
                      <DocumentCanvas
                        title={artifactTitle}
                        eyebrow="Canvas Markdown"
                        description={documentArtifact?.summary ?? "Resposta renderizada em modo canvas."}
                        className="border-black/5 bg-transparent dark:border-white/8"
                        bodyClassName="md:px-8 md:py-8"
                      >
                        <ChatMarkdown content={artifactContent} className="max-w-none" />
                      </DocumentCanvas>
                    )
                  ) : (
                    <EmptyArtifactState />
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="artifact" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              <section className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-400/18 text-rose-200">
                      {isQuizArtifact ? (
                        <ClipboardList className="size-4" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {effectiveArtifact ? artifactFilename : "Nenhum artefato disponível"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {effectiveArtifact
                          ? isQuizArtifact
                            ? "Quiz interativo"
                            : documentArtifact?.type === "html"
                              ? "HTML · pré-visualização"
                              : "Documento markdown"
                          : "Use as respostas com documento/quiz para preencher este painel."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!activeArtifact && fallbackArtifactMessage?.artifact && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={handleOpenFallbackArtifact}
                      >
                        Abrir painel
                      </Button>
                    )}
                    {canDownloadPdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={handleDownloadPDF}
                      >
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/8 bg-white/[0.02] p-2">
                <Tabs defaultValue="preview" className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="mb-2 w-fit rounded-md border border-white/8 bg-white/[0.03] p-1">
                    <TabsTrigger value="preview" className="h-7 rounded-md text-xs">
                      <Eye className="mr-1 size-3.5" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="source" className="h-7 rounded-md text-xs">
                      <Code className="mr-1 size-3.5" />
                      Fonte
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="mt-0">
                    {effectiveArtifact ? (
                      <div className="min-h-[220px] rounded-lg border border-white/8 bg-black/20 p-2">
                        {isQuizArtifact ? (
                          <ScrollArea className="h-[300px]">
                            <div className="p-1">
                              <QuizCanvas
                                artifact={quizArtifact}
                                compact
                                onSessionChange={handleQuizSessionChange}
                              />
                            </div>
                          </ScrollArea>
                        ) : documentArtifact?.type === "html" ? (
                          <div className="h-[300px]">
                            <HtmlPreview content={artifactContent} />
                          </div>
                        ) : (
                          <ScrollArea className="h-[300px]">
                            <div className="p-1">
                              <DocumentCanvas
                                title={artifactTitle}
                                eyebrow="Documento pronto"
                                description="Preview editorial do artefato da conversa."
                                compact
                                className="border-white/8 bg-white/[0.02]"
                                bodyClassName="md:py-6"
                              >
                                <ChatMarkdown content={artifactContent} className="max-w-none" />
                              </DocumentCanvas>
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    ) : (
                      <EmptyArtifactState />
                    )}
                  </TabsContent>

                  <TabsContent value="source" className="mt-0">
                    <div className="rounded-lg border border-white/8 bg-black/20 p-2">
                      {effectiveArtifact ? (
                        <CodeBlock
                          language={artifactSourceLanguage}
                          value={artifactContent}
                          showLineNumbers
                        />
                      ) : (
                        <CodeBlock
                          language="markdown"
                          value={"# Sem artefato ativo\n\nGere um documento ou quiz para liberar a fonte nesta aba.\n"}
                          showLineNumbers
                        />
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              <ActivityTimeline
                title="Atividade recente do assistente"
                events={activityEvents}
                compact
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              <ActivityTimeline title="Linha do tempo da conversa" events={activityEvents} />
              <section className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                <h3 className="mb-2 text-xs font-semibold text-foreground">
                  Resumo da execução
                </h3>
                <div className="space-y-2 text-[11px] text-muted-foreground">
                  <p>
                    Último evento:{" "}
                    {latestEvent
                      ? `${latestEvent.label} às ${formatClock(latestEvent.timestamp)}`
                      : "sem atividade registrada"}.
                  </p>
                  <p>Prompts enviados: {promptsCount}.</p>
                  <p>Artefatos gerados: {artifactsCount}.</p>
                  <p>Eventos de citação: {citationEventsCount}.</p>
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              <section className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Notas da rodada</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {notesDirty ? "Alterações pendentes" : "Sincronizado"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Objetivo
                    </label>
                    <Input
                      value={notesDraft.objective}
                      onChange={(event) =>
                        updateNotesField("objective", event.target.value)
                      }
                      placeholder="Objetivo curto da conversa"
                      className="h-8 rounded-md border-white/8 bg-black/20 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Notas
                    </label>
                    <Textarea
                      value={notesDraft.body}
                      onChange={(event) =>
                        updateNotesField("body", event.target.value)
                      }
                      placeholder="Resumo, decisões e contexto da rodada."
                      className="min-h-24 rounded-md border-white/8 bg-black/20 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Próximos passos (um por linha)
                    </label>
                    <Textarea
                      value={notesDraft.nextStepsText}
                      onChange={(event) =>
                        updateNotesField("nextStepsText", event.target.value)
                      }
                      placeholder={"Ex:\nRodar build final\nPublicar no serviço"}
                      className="min-h-20 rounded-md border-white/8 bg-black/20 text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Persistência server-side por conversa.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || !notesDirty}
                    className="h-8 rounded-md bg-cyan-300 px-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-40"
                  >
                    {isSavingNotes ? (
                      <>
                        <LoaderCircle className="mr-1 size-3.5 animate-spin" />
                        Salvando
                      </>
                    ) : (
                      <>
                        <Save className="mr-1 size-3.5" />
                        Salvar notas
                      </>
                    )}
                  </Button>
                </div>
              </section>

              <section className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[11px] text-muted-foreground">
                Essas notas ficam vinculadas ao <span className="text-foreground">ID da conversa</span> e são carregadas automaticamente quando tu reabre o mesmo thread.
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
