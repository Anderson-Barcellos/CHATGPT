"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
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
import { CanvasContent } from "@/components/workspace-v2/canvas/CanvasContent";
import { useNotesContext } from "@/components/workspace-v2/NotesProvider";
import { useConversations } from "@/hooks/useConversations";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";
import { saveConversationWorkspace } from "@/lib/storage/conversations";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type {
  ActivePanelTab,
  ConversationWorkspace,
  ConversationWorkspaceNotes,
  Message,
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
        : streamStatus === "aborted" || streamStatus === "interrupted"
          ? "warning"
          : streamStatus === "streaming"
            ? "running"
            : "done";

    const assistantLabel =
      streamStatus === "failed"
        ? "Resposta do assistente falhou"
        : streamStatus === "aborted"
          ? "Geração cancelada pelo usuário"
          : streamStatus === "interrupted"
            ? "Resposta interrompida no streaming"
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
        <span className="text-nano text-cyan-100/85">
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
                    <p className="text-micro text-foreground/90">{event.label}</p>
                    {event.detail && (
                      <p className="truncate text-nano text-muted-foreground/75">
                        {event.detail}
                      </p>
                    )}
                  </div>
                </div>
                <span className="tabular-nums text-nano text-muted-foreground">
                  {formatClock(event.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-white/8 bg-black/20 px-3 py-4 text-micro text-muted-foreground">
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
        <p className="mt-1 text-micro leading-relaxed text-muted-foreground">
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
    closeArtifact,
    activePanelTab,
    setActivePanelTab,
  } = useUIStore();
  const { _register } = useNotesContext();
  const { activeConversationId, messages } = useChatStore();
  const { conversations = [] } = useConversations();

  const [copied, setCopied] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesDraft, setNotesDraft] = useState<NotesDraft>(EMPTY_NOTES_DRAFT);
  const previousConversationIdRef = useRef<string | null>(null);
  const notesDraftBodyRef = useRef(notesDraft.body);

  useEffect(() => {
    notesDraftBodyRef.current = notesDraft.body;
  }, [notesDraft.body]);

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

  const documentArtifact =
    effectiveArtifact?.kind === "document" ? effectiveArtifact : null;

  const artifactTitle = effectiveArtifact?.title || "Sem artefato";
  const artifactPayload = effectiveArtifact
    ? effectiveArtifact.kind === "document"
      ? effectiveArtifact.content
      : JSON.stringify(effectiveArtifact.quiz, null, 2)
    : "";
  const artifactExtension = documentArtifact
    ? documentArtifact.type === "html"
      ? "html"
      : "md"
    : "json";

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

  const handleCopy = useCallback(async () => {
    if (!effectiveArtifact) {
      toast.info("Sem artefato para copiar nesta conversa.");
      return;
    }

    try {
      await navigator.clipboard.writeText(artifactPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Nao consegui copiar o artefato.");
    }
  }, [artifactPayload, effectiveArtifact]);

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
    const blob = new Blob([artifactPayload], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${artifactTitle || "artefato"}.${artifactExtension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [
    artifactPayload,
    artifactExtension,
    artifactTitle,
    documentArtifact,
    effectiveArtifact,
  ]);

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

  useEffect(() => {
    return _register((text, msgId) => {
      const snippet = `\n\n---\n> ${text}\n> _Fonte: #${msgId.slice(0, 8)}_\n`;
      updateNotesField("body", notesDraftBodyRef.current + snippet);
    });
  }, [_register, updateNotesField]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-3 xl:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Painel operacional</h2>
          <p className="text-nano uppercase tracking-label text-muted-foreground">
            Contexto
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            closeArtifact();
            // Fechar o Sheet mobile (controlado em GauchoChatShellV2) — closeArtifact sozinho
            // não reseta mobileContextOpen, então o Sheet fica aberto mostrando estado vazio
            window.dispatchEvent(new CustomEvent("gaucho:close-context-panel"));
          }}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <Tabs
        value={activePanelTab}
        onValueChange={(v) => setActivePanelTab(v as ActivePanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b border-white/8 px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Workspace</h2>
              <p className="text-nano uppercase tracking-label text-muted-foreground">
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
            <TabsTrigger value="artifact" className="h-7 rounded-md text-xs">
              Canvas
            </TabsTrigger>
            <TabsTrigger value="activity" className="h-7 rounded-md text-xs">
              Atividade
            </TabsTrigger>
            <TabsTrigger value="notes" className="h-7 rounded-md text-xs">
              Notas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="artifact" className="mt-0 min-h-0 flex-1 overflow-hidden">
          {effectiveArtifact ? (
            <div className="h-full">
              <CanvasContent artifact={effectiveArtifact} />
            </div>
          ) : (
            <div className="p-3">
              <EmptyArtifactState />
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-3">
              <ActivityTimeline title="Linha do tempo da conversa" events={activityEvents} />
              <section className="rounded-lg border border-white/8 bg-white/[0.025] p-3">
                <h3 className="mb-2 text-xs font-semibold text-foreground">
                  Resumo da execução
                </h3>
                <div className="space-y-2 text-micro text-muted-foreground">
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
                  <span className="text-nano text-muted-foreground">
                    {notesDirty ? "Alterações pendentes" : "Sincronizado"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
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
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
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
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
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
                  <span className="text-nano text-muted-foreground">
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

              <section className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-micro text-muted-foreground">
                Essas notas ficam vinculadas ao <span className="text-foreground">ID da conversa</span> e são carregadas automaticamente quando tu reabre o mesmo thread.
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
