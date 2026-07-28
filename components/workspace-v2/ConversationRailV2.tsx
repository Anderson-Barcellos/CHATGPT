"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Clock,
  FolderClosed,
  Menu,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { useConversations } from "@/hooks/useConversations";
import { useDebouncedSearch } from "@/lib/performance/debounce";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationRailV2Props {
  onOpenSettings: () => void;
  onClose?: () => void;
  compact?: boolean;
}

type RailFilter = "all" | "pinned" | "recent" | "folders";
type ConversationSection = "Hoje" | "Ontem" | "Esta semana" | "Arquivadas";

const FILTER_OPTIONS: { value: RailFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pinned", label: "Fixadas" },
  { value: "recent", label: "Recentes" },
  { value: "folders", label: "Pastas" },
];

const SECTION_ORDER: ConversationSection[] = [
  "Hoje",
  "Ontem",
  "Esta semana",
  "Arquivadas",
];

const RAIL_CONTROL_BUTTON_CLASS =
  "gc-clinical-input-surface rounded-xl border border-[color:var(--gc-border-soft)] text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground";
const RAIL_SURFACE_CARD_CLASS =
  "gc-clinical-card rounded-xl border border-[color:var(--gc-border-soft)]";
const RAIL_FILTER_BUTTON_CLASS =
  "h-7 rounded-lg text-nano font-semibold text-muted-foreground transition-colors hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-[0_6px_14px_rgba(15,118,110,0.14)]";

function getConversationDate(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getConversationSection(date: Date): ConversationSection {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (date >= startOfToday) return "Hoje";
  if (date >= startOfYesterday) return "Ontem";
  if (date >= sevenDaysAgo) return "Esta semana";
  return "Arquivadas";
}

function formatTimeLabel(date: Date): string {
  try {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

function getConversationPreview(conversation: Conversation): string {
  const latestMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.content.trim().length > 0);
  if (!latestMessage) return "Sem mensagens ainda.";
  const normalized = latestMessage.content.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 72);
}

interface ConversationRowV2Props {
  conversation: Conversation;
  isActive: boolean;
  disabled: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function ConversationRowV2({
  conversation,
  isActive,
  disabled,
  isPinned,
  onSelect,
  onDelete,
  onTogglePin,
}: ConversationRowV2Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updatedAt = getConversationDate(conversation.updatedAt);
  const preview = getConversationPreview(conversation);

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        aria-current={isActive ? "page" : undefined}
        aria-disabled={disabled}
        data-active={isActive}
        onClick={onSelect}
        className={cn(
            "gc-conversation-row flex w-full min-w-0 items-start gap-2 rounded-xl border border-transparent px-2.5 py-2 pr-9 text-left text-muted-foreground transition-colors hover:border-[color:var(--gc-border-soft)] hover:bg-[var(--gc-surface-control)] hover:text-foreground data-[active=true]:border-primary/35 data-[active=true]:bg-[var(--gc-clinical-active-bg)] data-[active=true]:text-foreground data-[active=true]:shadow-[var(--gc-clinical-active-shadow)]",
          disabled && "cursor-not-allowed opacity-70"
        )}
      >
        <span
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            isActive ? "bg-primary" : "bg-muted-foreground/35"
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 flex items-center gap-1.5">
            <span className="block truncate text-caption font-medium">
              {conversation.title || "Nova conversa"}
            </span>
            {isPinned && (
              <span className="inline-flex shrink-0 rounded border border-primary/20 bg-primary/10 px-1 py-0.5 text-nano font-medium text-primary">
                fixada
              </span>
            )}
          </span>
          <span className="block truncate text-nano text-muted-foreground/80">{preview}</span>
          <span className="mt-0.5 block text-nano text-muted-foreground/65">
            {formatTimeLabel(updatedAt)}
          </span>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 rounded-md opacity-0 transition-opacity hover:bg-[var(--gc-surface-control-hover)] group-hover:opacity-100 data-[state=open]:opacity-100 [@media(pointer:coarse)]:opacity-100"
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onTogglePin}>
            {isPinned ? (
              <PinOff className="mr-2 size-3.5" />
            ) : (
              <Pin className="mr-2 size-3.5" />
            )}
            {isPinned ? "Desafixar" : "Fixar"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-3.5" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir conversa?"
        description="Essa conversa sai do histórico local. Se ela estiver aberta, o app troca para outra conversa ou cria uma nova."
        confirmLabel="Excluir"
        onConfirm={onDelete}
      />
    </div>
  );
}

export function ConversationRailV2({ onOpenSettings, onClose, compact }: ConversationRailV2Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RailFilter>("all");
  const [mountTimestamp] = useState(() => Date.now());
  const debouncedQuery = useDebouncedSearch(query, 180);
  const {
    conversations = [],
    isLoading,
    error,
    createConversation,
    deleteConversation,
  } = useConversations();
  const { activeConversationId, isStreaming, setActiveConversationId } = useChatStore();

  const showStreamingGuard = useCallback(() => {
    toast.info("Aguarde a resposta terminar para trocar de conversa.");
  }, []);

  const handleCreateConversation = useCallback(async () => {
    if (isStreaming) {
      showStreamingGuard();
      return;
    }

    try {
      const id = await createConversation("Nova conversa");
      setActiveConversationId(id);
    } catch (creationError) {
      console.error("[ConversationRailV2] Falha ao criar conversa:", creationError);
      toast.error("Nao consegui abrir uma nova conversa agora.");
    }
  }, [createConversation, isStreaming, setActiveConversationId, showStreamingGuard]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) return;
      if (isStreaming) {
        showStreamingGuard();
        return;
      }
      setActiveConversationId(id);
      onClose?.();
    },
    [activeConversationId, isStreaming, onClose, setActiveConversationId, showStreamingGuard]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (isStreaming) {
        showStreamingGuard();
        return;
      }

      const remaining = conversations.filter((conversation) => conversation.id !== id);

      try {
        await deleteConversation(id);

        if (id === activeConversationId) {
          const nextConversation = remaining[0];

          if (nextConversation) {
            setActiveConversationId(nextConversation.id);
          } else {
            const newId = await createConversation("Nova conversa");
            setActiveConversationId(newId);
          }
        }
      } catch (deletionError) {
        console.error("[ConversationRailV2] Falha ao excluir conversa:", deletionError);
        toast.error("Nao consegui excluir essa conversa agora.");
      }
    },
    [
      activeConversationId,
      conversations,
      createConversation,
      deleteConversation,
      isStreaming,
      setActiveConversationId,
      showStreamingGuard,
    ]
  );

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aDate = getConversationDate(a.updatedAt).getTime();
      const bDate = getConversationDate(b.updatedAt).getTime();
      return bDate - aDate;
    });
  }, [conversations]);

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("gaucho-pinned-conversations");
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleTogglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.success("Conversa desafixada.");
      } else {
        next.add(id);
        toast.success("Conversa fixada.");
      }
      try {
        localStorage.setItem("gaucho-pinned-conversations", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const visibleConversations = useMemo(() => {
    const recentCutoff = mountTimestamp - 1000 * 60 * 60 * 24 * 7;
    const normalizedQuery = debouncedQuery.trim().toLowerCase();

    return sortedConversations.filter((conversation) => {
      if (normalizedQuery.length > 0) {
        const target = `${conversation.title} ${getConversationPreview(conversation)}`.toLowerCase();
        if (!target.includes(normalizedQuery)) return false;
      }

      const isPinned = pinnedIds.has(conversation.id);
      const updatedAt = getConversationDate(conversation.updatedAt).getTime();
      const isRecent = updatedAt >= recentCutoff;

      if (filter === "pinned") return isPinned;
      if (filter === "recent") return isRecent;
      if (filter === "folders") return !isRecent;
      return true;
    });
  }, [debouncedQuery, filter, mountTimestamp, pinnedIds, sortedConversations]);

  const sections = useMemo(() => {
    const grouped = new Map<ConversationSection, Conversation[]>();

    if (filter === "all") {
      for (const conversation of visibleConversations) {
        const section = getConversationSection(getConversationDate(conversation.updatedAt));
        const list = grouped.get(section) ?? [];
        list.push(conversation);
        grouped.set(section, list);
      }
      return SECTION_ORDER
        .map((section) => ({
          title: section,
          conversations: grouped.get(section) ?? [],
        }))
        .filter((section) => section.conversations.length > 0);
    }

    return [
      {
        title:
          filter === "pinned" ? "Fixadas" : filter === "recent" ? "Recentes" : "Pastas",
        conversations: visibleConversations,
      },
    ];
  }, [filter, visibleConversations]);

  const pinnedConversations = useMemo(() => {
    const ids = pinnedIds;
    return sortedConversations.filter((c) => ids.has(c.id));
  }, [pinnedIds, sortedConversations]);

  const todayCount = useMemo(
    () =>
      sortedConversations.filter(
        (conversation) =>
          getConversationSection(getConversationDate(conversation.updatedAt)) === "Hoje"
      ).length,
    [sortedConversations]
  );

  if (compact) {
    return (
      <div className="flex h-full flex-col items-center gap-1 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <GPTLogo size={18} />
        </div>
        <div className="h-px w-5 bg-[var(--gc-border-soft)]" />
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden">
          {pinnedConversations.slice(0, 8).map((conv) => (
            <button
              key={conv.id}
              type="button"
              disabled={isStreaming}
              onClick={() => handleSelectConversation(conv.id)}
              title={conv.title || "Conversa"}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-micro font-medium transition-colors",
                conv.id === activeConversationId
                  ? "border border-primary/25 bg-primary/10 text-primary"
                  : "border border-transparent text-muted-foreground hover:border-[color:var(--gc-border-soft)] hover:bg-[var(--gc-surface-control)] hover:text-foreground"
              )}
            >
              {(conv.title || "N")[0].toUpperCase()}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={isStreaming}
          onClick={handleCreateConversation}
          className={cn("size-8", RAIL_CONTROL_BUTTON_CLASS)}
        >
          <Plus className="size-3.5" />
        </Button>
        <button
          type="button"
          onClick={onClose}
          className={cn("size-8 flex items-center justify-center", RAIL_CONTROL_BUTTON_CLASS)}
          aria-label="Abrir sidebar completa"
        >
          <Menu className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="gc-conversation-rail flex h-full min-h-0 flex-col overflow-hidden">
      <div className="gc-rail-header gc-clinical-section-header shrink-0 border-b border-[color:var(--gc-border-soft)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/18 bg-primary/10 shadow-[0_10px_22px_rgba(15,118,110,0.10)]">
            <GPTLogo size={25} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">Gaucho Chat</h2>
            <p className="text-nano uppercase tracking-eyebrow text-muted-foreground">
              Conversas
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={isStreaming}
            onClick={handleCreateConversation}
            className="size-9 rounded-xl border border-primary/20 bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(15,118,110,0.18)] hover:bg-primary/90 hover:text-primary-foreground"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            className="gc-clinical-input-surface h-9 rounded-xl border-[color:var(--gc-border-soft)] pl-8 text-xs focus-visible:border-primary/45 focus-visible:ring-primary/15"
          />
        </div>

        <div className={cn("gc-rail-filters mt-2 grid grid-cols-4 gap-1 p-1", RAIL_SURFACE_CARD_CLASS)}>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              data-active={filter === option.value}
              className={RAIL_FILTER_BUTTON_CLASS}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="gc-rail-stats mt-2 grid grid-cols-2 gap-1.5">
          <div className={cn("px-2 py-1.5", RAIL_SURFACE_CARD_CLASS)}>
            <p className="text-nano uppercase tracking-label text-muted-foreground">Hoje</p>
            <p className="text-xs font-semibold text-foreground">{todayCount}</p>
          </div>
          <div className={cn("px-2 py-1.5", RAIL_SURFACE_CARD_CLASS)}>
            <p className="text-nano uppercase tracking-label text-muted-foreground">Fixadas</p>
            <p className="text-xs font-semibold text-foreground">{pinnedConversations.length}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-full min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-col gap-[var(--gc-mobile-panel-content-gap)] px-[var(--gc-mobile-panel-content-pad)] py-[var(--gc-mobile-panel-content-pad)] pb-5">
          {isLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={cn("h-12 animate-pulse", RAIL_SURFACE_CARD_CLASS)}
                />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-4 text-xs text-destructive">
              Falha ao carregar as conversas.
            </div>
          )}

          {!isLoading &&
            !error &&
            sections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="mb-1 flex items-center gap-1.5 px-1 text-nano font-semibold uppercase tracking-label text-muted-foreground">
                  {section.title === "Pastas" ? (
                    <FolderClosed className="size-3" />
                  ) : section.title === "Fixadas" ? (
                    <Pin className="size-3" />
                  ) : (
                    <Clock className="size-3" />
                  )}
                  {section.title}
                </div>
                <div className="flex flex-col gap-1.5">
                  {section.conversations.map((conversation) => (
                    <ConversationRowV2
                      key={conversation.id}
                      conversation={conversation}
                      isPinned={pinnedIds.has(conversation.id)}
                      isActive={conversation.id === activeConversationId}
                      disabled={isStreaming}
                      onSelect={() => handleSelectConversation(conversation.id)}
                      onDelete={() => handleDeleteConversation(conversation.id)}
                      onTogglePin={() => handleTogglePin(conversation.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

          {!isLoading && !error && visibleConversations.length === 0 && (
            <div className={cn("px-3 py-6 text-center text-xs text-muted-foreground", RAIL_SURFACE_CARD_CLASS)}>
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="gc-rail-footer shrink-0 border-t border-[color:var(--gc-border-soft)] p-[var(--gc-mobile-panel-content-pad)]">
        <Button
          variant="ghost"
          onClick={onOpenSettings}
          className={cn("h-9 w-full justify-start px-2 text-xs", RAIL_CONTROL_BUTTON_CLASS)}
        >
          <Settings className="mr-2 size-4" />
          Configurações
        </Button>
      </div>
    </div>
  );
}
