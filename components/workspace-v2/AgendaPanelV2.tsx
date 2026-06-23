"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Pencil,
  LoaderCircle,
  Plug,
  RefreshCw,
  Save,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceCapturesPanelV2 } from "@/components/workspace-v2/WorkspaceCapturesPanelV2";
import { ClientApiError } from "@/lib/api/errors";
import {
  CalendarDraftEditInput,
  CalendarEventDraft,
  GoogleCalendarEvent,
  GoogleCalendarIntegrationStatus,
  confirmCalendarDraft,
  discardCalendarDraft,
  disconnectGoogleIntegration,
  getGoogleIntegrationStatus,
  googleAuthStartUrl,
  isGoogleCalendarNotConnectedError,
  listCalendarDrafts,
  listCalendarEvents,
  updateCalendarDraft,
} from "@/lib/calendar/calendarApi";
import { useChatStore } from "@/stores/chatStore";

type LoadState = "idle" | "loading" | "ready" | "error";
const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_DRAFT_DURATION_MINUTES = 60;

interface AgendaState {
  status: GoogleCalendarIntegrationStatus | null;
  todayEvents: GoogleCalendarEvent[];
  upcomingEvents: GoogleCalendarEvent[];
  drafts: CalendarEventDraft[];
  eventError: string | null;
  draftError: string | null;
}

const EMPTY_AGENDA_STATE: AgendaState = {
  status: null,
  todayEvents: [],
  upcomingEvents: [],
  drafts: [],
  eventError: null,
  draftError: null,
};

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateTime(value?: { date?: string; dateTime?: string }): string {
  const raw = value?.dateTime ?? value?.date;
  if (!raw) return "horario indefinido";

  const parsed = value?.date
    ? new Date(`${raw}T00:00:00`)
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "horario indefinido";

  if (value?.date) {
    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDraftRange(draft: CalendarEventDraft): string {
  if (!draft.start?.dateTime) return "sem horario definido";
  const start = formatDateTime({ dateTime: draft.start.dateTime });
  const end = draft.end?.dateTime ? formatDateTime({ dateTime: draft.end.dateTime }) : null;
  return end ? `${start} ate ${end}` : start;
}

function dateTimeToLocalInput(value?: { dateTime?: string }): string {
  if (!value?.dateTime) return "";
  const parsed = new Date(value.dateTime);
  if (Number.isNaN(parsed.getTime())) return "";

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localInputToCalendarDateTime(
  value: string,
  timeZone?: string
): CalendarDraftEditInput["start"] | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return {
    dateTime: parsed.toISOString(),
    timeZone: timeZone || DEFAULT_TIME_ZONE,
  };
}

function draftDurationMinutes(draft: CalendarEventDraft): number {
  if (!draft.start?.dateTime || !draft.end?.dateTime) {
    return DEFAULT_DRAFT_DURATION_MINUTES;
  }

  const startMs = new Date(draft.start.dateTime).getTime();
  const endMs = new Date(draft.end.dateTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return DEFAULT_DRAFT_DURATION_MINUTES;
  }

  return Math.max(1, Math.round((endMs - startMs) / 60_000));
}

interface DraftEditFormState {
  summary: string;
  startLocal: string;
  durationMinutes: string;
  location: string;
  description: string;
}

function draftToFormState(draft: CalendarEventDraft): DraftEditFormState {
  return {
    summary: draft.summary || "",
    startLocal: dateTimeToLocalInput(draft.start),
    durationMinutes: String(draftDurationMinutes(draft)),
    location: draft.location || "",
    description: draft.description || "",
  };
}

function readableError(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function StatusPill({ status }: { status: GoogleCalendarIntegrationStatus | null }) {
  const connected = Boolean(status?.connected);
  const label = connected ? "Google conectado" : "Google desconectado";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-nano font-medium ${
        connected
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }`}
    >
      {connected ? <Plug className="size-3" /> : <Unplug className="size-3" />}
      {label}
    </span>
  );
}

function EventList({
  title,
  events,
  emptyText,
}: {
  title: string;
  events: GoogleCalendarEvent[];
  emptyText: string;
}) {
  return (
    <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <CalendarDays className="size-3.5 text-primary" />
          {title}
        </h3>
        <span className="text-nano text-muted-foreground">{events.length}</span>
      </div>

      {events.length > 0 ? (
        <div className="space-y-2">
          {events.map((event) => (
            <article
              key={event.id}
              className="gc-clinical-row rounded-xl border border-[color:var(--gc-border-soft)] px-2.5 py-2"
            >
              <p className="truncate text-micro font-medium text-foreground/90">
                {event.summary || "Evento sem titulo"}
              </p>
              <div className="mt-1 flex items-center gap-1 text-nano text-muted-foreground">
                <Clock className="size-3" />
                <span>{formatDateTime(event.start)}</span>
              </div>
              {event.location && (
                <p className="mt-1 truncate text-nano text-muted-foreground/80">
                  {event.location}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function DraftCard({
  draft,
  connected,
  isConfirming,
  isDiscarding,
  isSaving,
  onConfirm,
  onDiscard,
  onSave,
}: {
  draft: CalendarEventDraft;
  connected: boolean;
  isConfirming: boolean;
  isDiscarding: boolean;
  isSaving: boolean;
  onConfirm: (draftId: string) => void;
  onDiscard: (draftId: string) => void;
  onSave: (draftId: string, input: CalendarDraftEditInput) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DraftEditFormState>(() => draftToFormState(draft));
  const actionLabel =
    draft.action === "cancel"
      ? "Cancelar"
      : draft.action === "update"
        ? "Atualizar"
        : "Criar";
  const duration = Number.parseInt(form.durationMinutes, 10);
  const canSave =
    form.summary.trim().length > 0 &&
    (draft.action !== "create" || form.startLocal.trim().length > 0) &&
    Number.isFinite(duration) &&
    duration > 0 &&
    duration <= 24 * 60;

  const updateForm = useCallback(
    (updates: Partial<DraftEditFormState>) => {
      setForm((current) => ({ ...current, ...updates }));
    },
    []
  );

  const handleCancelEdit = useCallback(() => {
    setForm(draftToFormState(draft));
    setIsEditing(false);
  }, [draft]);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const start = localInputToCalendarDateTime(
      form.startLocal,
      draft.start?.timeZone || draft.end?.timeZone
    );
    onSave(draft.id, {
      summary: form.summary,
      location: form.location,
      description: form.description,
      ...(start ? { start } : {}),
      durationMinutes: duration,
    });
  }, [canSave, draft, duration, form, onSave]);

  if (isEditing) {
    return (
      <article className="gc-clinical-row rounded-xl border border-primary/25 px-2.5 py-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-micro font-semibold text-foreground/90">
              Revisar rascunho
            </p>
            <p className="text-nano text-muted-foreground">
              Edicao local antes de confirmar no Google.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-nano text-primary">
            {actionLabel}
          </span>
        </div>

        <div className="space-y-2">
          <label className="block space-y-1 text-nano font-medium text-muted-foreground">
            <span>Titulo</span>
            <Input
              value={form.summary}
              onChange={(event) => updateForm({ summary: event.target.value })}
              className="h-8 rounded-md text-xs"
            />
          </label>

          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
            <label className="block space-y-1 text-nano font-medium text-muted-foreground">
              <span>Inicio</span>
              <Input
                type="datetime-local"
                value={form.startLocal}
                onChange={(event) => updateForm({ startLocal: event.target.value })}
                className="h-8 rounded-md text-xs"
              />
            </label>
            <label className="block space-y-1 text-nano font-medium text-muted-foreground">
              <span>Min</span>
              <Input
                type="number"
                min={1}
                max={24 * 60}
                value={form.durationMinutes}
                onChange={(event) =>
                  updateForm({ durationMinutes: event.target.value })
                }
                className="h-8 rounded-md text-xs"
              />
            </label>
          </div>

          <label className="block space-y-1 text-nano font-medium text-muted-foreground">
            <span>Local</span>
            <Input
              value={form.location}
              onChange={(event) => updateForm({ location: event.target.value })}
              className="h-8 rounded-md text-xs"
            />
          </label>

          <label className="block space-y-1 text-nano font-medium text-muted-foreground">
            <span>Descricao</span>
            <Textarea
              value={form.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              className="min-h-20 rounded-md text-xs"
            />
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={handleCancelEdit}
            disabled={isSaving}
            className="h-7 rounded-md px-2 text-nano"
          >
            <X className="size-3" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="h-7 rounded-md px-2 text-nano"
          >
            {isSaving ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            Salvar
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article className="gc-clinical-row rounded-xl border border-[color:var(--gc-border-soft)] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-micro font-semibold text-foreground/90">
            {draft.summary}
          </p>
          <p className="mt-1 text-nano text-muted-foreground">
            {actionLabel} - {formatDraftRange(draft)}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-nano text-primary">
          revisar
        </span>
      </div>

      {draft.description && (
        <p className="mt-2 line-clamp-2 text-nano text-muted-foreground/85">
          {draft.description}
        </p>
      )}

      {!connected && (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-nano text-amber-700 dark:text-amber-300">
          Conecte o Google antes de confirmar este rascunho.
        </p>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          disabled={isConfirming || isDiscarding}
          className="h-7 rounded-md px-2 text-nano"
        >
          <Pencil className="size-3" />
          Editar
        </Button>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => onDiscard(draft.id)}
          disabled={isConfirming || isDiscarding}
          className="h-7 rounded-md px-2 text-nano text-rose-700 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-300"
        >
          {isDiscarding ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          Descartar
        </Button>
        <Button
          type="button"
          size="xs"
          onClick={() => onConfirm(draft.id)}
          disabled={!connected || isConfirming}
          className="h-7 rounded-md px-2 text-nano"
        >
          {isConfirming ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          Confirmar
        </Button>
      </div>
    </article>
  );
}

export function AgendaPanelV2() {
  const { activeConversationId } = useChatStore();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [agenda, setAgenda] = useState<AgendaState>(EMPTY_AGENDA_STATE);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [discardingDraftId, setDiscardingDraftId] = useState<string | null>(null);

  const visibleDrafts = useMemo(
    () => agenda.drafts.filter((draft) => draft.status === "pending"),
    [agenda.drafts]
  );

  const loadAgenda = useCallback(async () => {
    setLoadState("loading");

    try {
      const status = await getGoogleIntegrationStatus();
      const todayStart = startOfToday();
      const tomorrowStart = addDays(todayStart, 1);
      const nextWeekEnd = addDays(todayStart, 8);

      const draftsPromise = listCalendarDrafts("pending")
        .then((drafts) => ({ drafts, error: null }))
        .catch((error: unknown) => ({
          drafts: [] as CalendarEventDraft[],
          error: readableError(error, "Nao consegui carregar os rascunhos."),
        }));

      const eventsPromise = status.connected
        ? Promise.all([
            listCalendarEvents({
              timeMin: todayStart.toISOString(),
              timeMax: tomorrowStart.toISOString(),
              maxResults: 12,
            }),
            listCalendarEvents({
              timeMin: tomorrowStart.toISOString(),
              timeMax: nextWeekEnd.toISOString(),
              maxResults: 24,
            }),
          ])
            .then(([todayEvents, upcomingEvents]) => ({
              todayEvents,
              upcomingEvents,
              error: null,
            }))
            .catch((error: unknown) => ({
              todayEvents: [] as GoogleCalendarEvent[],
              upcomingEvents: [] as GoogleCalendarEvent[],
              error: isGoogleCalendarNotConnectedError(error)
                ? null
                : readableError(error, "Nao consegui carregar os eventos."),
            }))
        : Promise.resolve({
            todayEvents: [] as GoogleCalendarEvent[],
            upcomingEvents: [] as GoogleCalendarEvent[],
            error: null,
          });

      const [draftsResult, eventsResult] = await Promise.all([
        draftsPromise,
        eventsPromise,
      ]);

      setAgenda({
        status,
        todayEvents: eventsResult.todayEvents,
        upcomingEvents: eventsResult.upcomingEvents,
        drafts: draftsResult.drafts,
        eventError: eventsResult.error,
        draftError: draftsResult.error,
      });
      setLoadState("ready");
    } catch (error) {
      setAgenda((current) => ({
        ...current,
        status: null,
        eventError: readableError(error, "Nao consegui carregar a agenda."),
      }));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);

  useEffect(() => {
    const handleDraftCreated = () => {
      void loadAgenda();
    };

    window.addEventListener("gaucho:calendar-draft-created", handleDraftCreated);
    return () => {
      window.removeEventListener("gaucho:calendar-draft-created", handleDraftCreated);
    };
  }, [loadAgenda]);

  const handleConnect = useCallback(() => {
    window.location.href = googleAuthStartUrl();
  }, []);

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      const status = await disconnectGoogleIntegration();
      setAgenda((current) => ({
        ...current,
        status,
        todayEvents: [],
        upcomingEvents: [],
        eventError: null,
      }));
      toast.success("Google Calendar desconectado.");
    } catch (error) {
      toast.error(readableError(error, "Nao consegui desconectar o Google."));
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  const handleConfirmDraft = useCallback(
    async (draftId: string) => {
      if (!agenda.status?.connected) {
        toast.info("Conecte o Google antes de confirmar rascunhos.");
        return;
      }

      setConfirmingDraftId(draftId);
      try {
        await confirmCalendarDraft(draftId);
        toast.success("Rascunho confirmado no Google Calendar.");
        await loadAgenda();
      } catch (error) {
        toast.error(readableError(error, "Nao consegui confirmar o rascunho."));
        await loadAgenda();
      } finally {
        setConfirmingDraftId(null);
      }
    },
    [agenda.status?.connected, loadAgenda]
  );

  const handleSaveDraft = useCallback(
    async (draftId: string, input: CalendarDraftEditInput) => {
      setSavingDraftId(draftId);
      try {
        await updateCalendarDraft(draftId, input);
        toast.success("Rascunho atualizado localmente.");
        await loadAgenda();
      } catch (error) {
        toast.error(readableError(error, "Nao consegui salvar o rascunho."));
      } finally {
        setSavingDraftId(null);
      }
    },
    [loadAgenda]
  );

  const handleDiscardDraft = useCallback(async (draftId: string) => {
    setDiscardingDraftId(draftId);
    try {
      await discardCalendarDraft(draftId);
      toast.success("Rascunho descartado.");
      await loadAgenda();
    } catch (error) {
      toast.error(readableError(error, "Nao consegui descartar o rascunho."));
    } finally {
      setDiscardingDraftId(null);
    }
  }, [loadAgenda]);

  const status = agenda.status;
  const isLoading = loadState === "loading" || loadState === "idle";
  const canConnect =
    status && !status.connected && status.oauthConfigured && status.tokenStoreConfigured;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-[var(--gc-mobile-panel-content-gap)] p-[var(--gc-mobile-panel-content-pad)]">
        <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-foreground">Agenda Google</h3>
              <p className="mt-1 text-nano text-muted-foreground">
                Eventos e rascunhos locais com confirmacao manual.
              </p>
            </div>
            <StatusPill status={status} />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              Carregando agenda.
            </div>
          ) : (
            <div className="space-y-2">
              {status && !status.oauthConfigured && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-micro text-amber-700 dark:text-amber-300">
                  OAuth Google ainda precisa das variaveis de ambiente.
                </p>
              )}
              {status && !status.tokenStoreConfigured && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-micro text-amber-700 dark:text-amber-300">
                  Falta configurar GOOGLE_TOKEN_ENCRYPTION_KEY.
                </p>
              )}
              {status?.error && (
                <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {status.error}
                </p>
              )}
              {agenda.eventError && (
                <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {agenda.eventError}
                </p>
              )}
              {agenda.draftError && (
                <p className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-micro text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {agenda.draftError}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void loadAgenda()}
              disabled={isLoading}
              className="h-7 rounded-md px-2 text-nano"
            >
              <RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            {status?.connected ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => void handleDisconnect()}
                disabled={isDisconnecting}
                className="h-7 rounded-md px-2 text-nano"
              >
                {isDisconnecting ? (
                  <LoaderCircle className="size-3 animate-spin" />
                ) : (
                  <Unplug className="size-3" />
                )}
                Desconectar
              </Button>
            ) : (
              <Button
                type="button"
                size="xs"
                onClick={handleConnect}
                disabled={!canConnect}
                className="h-7 rounded-md px-2 text-nano"
              >
                <Plug className="size-3" />
                Conectar Google
              </Button>
            )}
          </div>
        </section>

        <EventList
          title="Hoje"
          events={agenda.todayEvents}
          emptyText={
            status?.connected
              ? "Nenhum evento hoje."
              : "Conecte o Google para ver os eventos de hoje."
          }
        />

        <EventList
          title="Proximos 7 dias"
          events={agenda.upcomingEvents}
          emptyText={
            status?.connected
              ? "Nenhum evento nos proximos dias."
              : "Conecte o Google para ver os proximos eventos."
          }
        />

        <WorkspaceCapturesPanelV2
          context="calendar"
          conversationId={activeConversationId}
          compact
        />

        <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground">Rascunhos</h3>
            <span className="text-nano text-muted-foreground">
              {visibleDrafts.length} pendente(s)
            </span>
          </div>

          {visibleDrafts.length > 0 ? (
            <div className="space-y-2">
              {visibleDrafts.map((draft) => (
                <DraftCard
                  key={`${draft.id}:${draft.updatedAt}`}
                  draft={draft}
                  connected={Boolean(status?.connected)}
                  isConfirming={confirmingDraftId === draft.id}
                  isDiscarding={discardingDraftId === draft.id}
                  isSaving={savingDraftId === draft.id}
                  onConfirm={handleConfirmDraft}
                  onDiscard={handleDiscardDraft}
                  onSave={handleSaveDraft}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] px-3 py-4 text-micro text-muted-foreground">
              Sem rascunhos pendentes.
            </p>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}
