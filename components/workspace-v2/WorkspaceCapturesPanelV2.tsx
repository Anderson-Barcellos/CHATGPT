"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  LoaderCircle,
  Mic,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ClientApiError } from "@/lib/api/errors";
import { createCalendarDraftFromText } from "@/lib/calendar/calendarApi";
import {
  WorkspaceNote,
  createWorkspaceNote,
  deleteWorkspaceNote,
  listWorkspaceNotes,
} from "@/lib/storage/workspaceNotesApi";

interface WorkspaceCapturesPanelV2Props {
  context: "notes" | "calendar";
  conversationId?: string | null;
  compact?: boolean;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatNoteTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "agora";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function noteSourceLabel(note: WorkspaceNote): string {
  if (note.source === "stt") return "voz";
  if (note.source === "chat") return "chat";
  if (note.source === "calendar") return "agenda";
  return "manual";
}

export function WorkspaceCapturesPanelV2({
  context,
  conversationId,
  compact = false,
}: WorkspaceCapturesPanelV2Props) {
  const {
    audioLevel,
    error: speechError,
    isSupported,
    recordingDurationMs,
    status: speechStatus,
    startRecording,
    stopRecording,
  } = useSpeechToText();
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftingNoteId, setDraftingNoteId] = useState<string | null>(null);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(
    () => new Set()
  );

  const isRecording = speechStatus === "recording";
  const isTranscribing = speechStatus === "transcribing";
  const collapsedLimit = compact ? 3 : 5;
  const visibleNotes = useMemo(
    () => (isExpanded ? notes : notes.slice(0, collapsedLimit)),
    [collapsedLimit, isExpanded, notes]
  );
  const hiddenCount = Math.max(0, notes.length - collapsedLimit);
  const contextLabel = context === "calendar" ? "Agenda" : "Notas";
  const contextTag = context === "calendar" ? "agenda" : "notas";

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextNotes = await listWorkspaceNotes();
      setNotes(nextNotes);
    } catch (error) {
      setLoadError(readableError(error, "Nao consegui carregar capturas locais."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadNotes(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadNotes]);

  useEffect(() => {
    const handleExternalNote = () => {
      void loadNotes();
    };

    window.addEventListener("gaucho:workspace-note-created", handleExternalNote);
    return () => {
      window.removeEventListener("gaucho:workspace-note-created", handleExternalNote);
    };
  }, [loadNotes]);

  const saveTranscript = useCallback(
    async (text: string) => {
      setIsSaving(true);
      try {
        const note = await createWorkspaceNote({
          title: `Captura por voz - ${contextLabel}`,
          body: text,
          source: "stt",
          ...(conversationId ? { conversationId } : {}),
          tags: ["voz", contextTag],
        });
        setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)]);
        setExpandedNoteIds((current) => new Set(current).add(note.id));
        toast.success("Captura de voz salva nas notas locais.");

        if (context === "calendar") {
          try {
            await createCalendarDraftFromText({
              text,
              source: "stt",
              ...(conversationId ? { conversationId } : {}),
              sourceMessageId: note.id,
            });
            window.dispatchEvent(new CustomEvent("gaucho:calendar-draft-created"));
            toast.success("Rascunho de agenda criado para revisar.");
          } catch (error) {
            toast.info(
              readableError(error, "Captura salva, mas faltaram dados para agenda.")
            );
          }
        }
      } catch (error) {
        toast.error(readableError(error, "Nao consegui salvar a captura local."));
      } finally {
        setIsSaving(false);
      }
    },
    [context, contextLabel, contextTag, conversationId]
  );

  const handleDraftNote = useCallback(
    async (note: WorkspaceNote) => {
      setDraftingNoteId(note.id);
      try {
        await createCalendarDraftFromText({
          text: note.body,
          source: note.source === "stt" ? "stt" : "chat",
          ...(note.conversationId ? { conversationId: note.conversationId } : {}),
          sourceMessageId: note.id,
        });
        window.dispatchEvent(new CustomEvent("gaucho:calendar-draft-created"));
        toast.success("Rascunho de agenda criado para revisar.");
      } catch (error) {
        toast.error(readableError(error, "Nao consegui rascunhar agenda."));
      } finally {
        setDraftingNoteId(null);
      }
    },
    []
  );

  const handleRecordClick = useCallback(async () => {
    if (isRecording) {
      const transcript = await stopRecording();
      if (transcript) {
        await saveTranscript(transcript);
      }
      return;
    }

    await startRecording();
  }, [isRecording, saveTranscript, startRecording, stopRecording]);

  const handleDelete = useCallback(async (noteId: string) => {
    setDeletingNoteId(noteId);
    try {
      await deleteWorkspaceNote(noteId);
      setNotes((current) => current.filter((note) => note.id !== noteId));
      toast.success("Captura local removida.");
    } catch (error) {
      toast.error(readableError(error, "Nao consegui remover a captura."));
    } finally {
      setDeletingNoteId(null);
    }
  }, []);

  const handleCopy = useCallback(async (note: WorkspaceNote) => {
    try {
      await navigator.clipboard.writeText(note.body);
      setCopiedNoteId(note.id);
      toast.success("Nota copiada.");
      window.setTimeout(() => {
        setCopiedNoteId((current) => (current === note.id ? null : current));
      }, 1600);
    } catch {
      toast.error("Nao consegui copiar a nota.");
    }
  }, []);

  const toggleNoteExpansion = useCallback((noteId: string) => {
    setExpandedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }, []);

  return (
    <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground">Capturas locais</h3>
          <p className="mt-1 text-nano text-muted-foreground">
            Voz transcrita para notas globais.
          </p>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={() => void loadNotes()}
          disabled={isLoading || isRecording || isTranscribing}
          className="rounded-md"
          aria-label="Atualizar capturas"
        >
          <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mb-3 rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-micro font-medium text-foreground/90">
              {isRecording
                ? `Gravando ${formatDuration(recordingDurationMs)}`
                : isTranscribing || isSaving
                  ? "Processando captura"
                  : "Gravar captura"}
            </p>
            <p className="text-nano text-muted-foreground">
              {isSupported
                ? "Fala curta, para salvar como nota local."
                : "Microfone indisponivel neste navegador."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleRecordClick()}
            disabled={!isSupported || isTranscribing || isSaving}
            className="h-8 rounded-md px-2.5 text-xs"
          >
            {isTranscribing || isSaving ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : isRecording ? (
              <Square className="size-3.5" />
            ) : (
              <Mic className="size-3.5" />
            )}
            {isRecording ? "Parar" : "Gravar"}
          </Button>
        </div>

        {isRecording && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.max(8, Math.round(audioLevel * 100))}%` }}
            />
          </div>
        )}
      </div>

      {(speechError || loadError) && (
        <p className="mb-3 flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {speechError || loadError}
        </p>
      )}

      {visibleNotes.length > 0 ? (
        <div className="space-y-2">
          {visibleNotes.map((note) => {
            const canExpandNote =
              (note.body.length > 140 || note.body.includes("\n"));
            const isNoteExpanded = expandedNoteIds.has(note.id);

            return (
              <article
                key={note.id}
                className="gc-workspace-note rounded-xl border px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-micro font-medium text-foreground/90">
                      {note.title}
                    </p>
                    <p
                      className={`gc-workspace-note-body mt-1 whitespace-pre-wrap break-words text-nano ${
                        isNoteExpanded ? "" : "line-clamp-2"
                      }`}
                    >
                      {note.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => void handleCopy(note)}
                      className="rounded-md"
                      aria-label={copiedNoteId === note.id ? "Nota copiada" : "Copiar nota"}
                      title={copiedNoteId === note.id ? "Nota copiada" : "Copiar nota"}
                    >
                      {copiedNoteId === note.id ? (
                        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => void handleDelete(note.id)}
                      disabled={deletingNoteId === note.id}
                      className="rounded-md"
                      aria-label="Remover captura"
                    >
                      {deletingNoteId === note.id ? (
                        <LoaderCircle className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-nano text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {noteSourceLabel(note)}
                  </span>
                  <span>{formatNoteTime(note.createdAt)}</span>
                  {note.conversationId && <span>conversa vinculada</span>}
                </div>
                {(canExpandNote || context === "calendar") && (
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {canExpandNote && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => toggleNoteExpansion(note.id)}
                        className="h-7 rounded-md px-2 text-nano text-muted-foreground"
                      >
                        {isNoteExpanded ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                        {isNoteExpanded ? "Recolher" : "Ler completa"}
                      </Button>
                    )}
                    {context === "calendar" && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => void handleDraftNote(note)}
                        disabled={draftingNoteId === note.id}
                        className="h-7 rounded-md px-2 text-nano"
                      >
                        {draftingNoteId === note.id ? (
                          <LoaderCircle className="size-3 animate-spin" />
                        ) : (
                          <CalendarPlus className="size-3" />
                        )}
                        Rascunhar
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {(hiddenCount > 0 || isExpanded) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded((current) => !current)}
              className="h-7 w-full rounded-md text-nano text-muted-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" />
                  Ver todas ({notes.length})
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
          Nenhuma captura local ainda.
        </p>
      )}
    </section>
  );
}
