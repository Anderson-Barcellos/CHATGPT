"use client";

import { useState, useCallback, useRef } from "react";
import { useConversations } from "@/hooks/useConversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageCircle,
  Settings,
  Plus,
  Search,
  Trash2,
  ChevronDown,
  Clock,
  Archive,
  Star,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { useDebouncedSearch } from "@/lib/performance/debounce";
import type { Conversation } from "@/types";

interface SidebarModernProps {
  onOpenSettings?: () => void;
}

interface ConversationItemProps {
  conversation: Conversation & { favorite?: boolean };
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function relativeDate(date: Date): string {
  try {
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}sem`;
    return `${Math.floor(days / 30)}m`;
  } catch {
    return "";
  }
}

export function SidebarModern({ onOpenSettings }: SidebarModernProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedSearch(searchQuery, 200);
  const { conversations = [], createConversation, deleteConversation } = useConversations();
  const { activeConversationId, setActiveConversationId } = useChatStore();

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-indigo-500/20">
          <GPTLogo size={30} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gradient-gpt tracking-wide">GPT</h2>
          <p className="text-xs text-muted-foreground/70 uppercase tracking-[0.2em]">Conversas</p>
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 rounded-xl bg-white/5 hover:bg-white/10"
                onClick={async () => {
                  const id = await createConversation("Nova conversa");
                  setActiveConversationId(id);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right"><p>Nova conversa</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-3 pt-3 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/60 border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>

        <ScrollArea className="flex-1 -mx-1">
          <div className="space-y-1 p-1">
            <div className="mb-2">
              <p className="text-xs font-semibold text-muted-foreground px-2 pb-1 flex items-center gap-1 uppercase tracking-[0.2em]">
                <Clock className="h-3 w-3" />
                Recentes
              </p>
              {filteredConversations.slice(0, 5).map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => setActiveConversationId(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                />
              ))}
              {filteredConversations.length === 0 && (
                <div className="px-2 py-6 text-center">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/60">
                    Nenhuma conversa ainda.
                  </p>
                </div>
              )}
            </div>

            {filteredConversations.length > 5 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground uppercase tracking-[0.2em] transition-colors">
                  <Archive className="h-3 w-3" />
                  Anteriores ({filteredConversations.length - 5})
                  <ChevronDown className="ml-auto h-3 w-3" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                  {filteredConversations.slice(5).map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === activeConversationId}
                      onClick={() => setActiveConversationId(conv.id)}
                      onDelete={() => deleteConversation(conv.id)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="p-3 border-t border-white/5">
        <button
          onClick={onOpenSettings}
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground w-full",
            "px-3 py-2.5 rounded-xl transition-all",
            "hover:text-foreground hover:bg-white/10"
          )}
        >
          <Settings className="h-4 w-4" />
          Configuracoes
        </button>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, isActive, onClick, onDelete }: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setMenuOpen(true);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm cursor-pointer",
        "transition-all duration-150",
        isActive
          ? "bg-white/20 text-foreground shadow-sm"
          : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
    >
      <MessageCircle className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary")} />
      <div className="flex-1 min-w-0">
        <span className="block truncate text-xs font-medium">{conversation.title}</span>
        <span className="text-xs text-muted-foreground/60">
          {relativeDate(conversation.updatedAt)}
        </span>
      </div>
      {(conversation as Conversation & { favorite?: boolean }).favorite && (
        <Star className="h-3 w-3 text-yellow-500 shrink-0" />
      )}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu open={menuOpen} onOpenChange={(open) => { setMenuOpen(open); if (!open) setConfirmDelete(false); }}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {confirmDelete ? (
              <DropdownMenuItem
                onClick={() => { onDelete(); setMenuOpen(false); setConfirmDelete(false); }}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Confirmar exclusao?
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setConfirmDelete(true); }}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir conversa
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
