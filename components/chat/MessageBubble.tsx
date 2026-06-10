"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageContent } from "./MessageContent";
import { ReasoningPanel } from "./ReasoningPanel";
import { Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Pencil, X, Send, Globe, ExternalLink, Trash2, MoreHorizontal, FileIcon, FileText, CalendarPlus, LoaderCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OpenAIIcon } from "@/components/ui/icons";
import { QuickActionsBar } from "@/components/chat/QuickActionsBar";
import { useNotes } from "@/hooks/useNotes";
import { StickyNote } from "lucide-react";
import { createCalendarDraftFromText } from "@/lib/calendar/calendarApi";
import { useUIStore } from "@/stores/uiStore";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: () => void;
}

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const USER_AVATAR_SRC = `${APP_BASE_PATH}/images/anders-avatar.png`;

function formatTime(date: Date): string {
  try {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageBubble({ message, onEdit, onDelete, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { appendToNotes } = useNotes();
  const { setActivePanelTab } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDraftingCalendar, setIsDraftingCalendar] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTitle = isUser ? "Excluir este turno?" : "Excluir esta resposta?";
  const deleteDescription = isUser
    ? "Isso remove a tua mensagem e a resposta gerada a partir dela. Use editar se tu quiser refazer esse ponto da conversa."
    : "Isso remove somente esta resposta do assistente desta conversa.";
  const deleteLabel = isUser ? "Excluir turno" : "Excluir resposta";

  const handleTouchStart = useCallback(() => {
    if (isEditing) return;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setMenuOpen(true);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }, [isEditing]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = "auto";
      editRef.current.style.height = `${editRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  }, [editContent, message.id, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(false);
  }, [message.content]);

  const handleCalendarDraft = useCallback(async () => {
    setIsDraftingCalendar(true);
    try {
      await createCalendarDraftFromText({
        text: message.content,
        source: "chat",
        sourceMessageId: message.id,
      });
      setActivePanelTab("calendar");
      window.dispatchEvent(new CustomEvent("gaucho:calendar-draft-created"));
      toast.success("Rascunho de agenda criado para revisar.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Nao consegui rascunhar agenda com esse texto.";
      toast.error(errorMessage);
    } finally {
      setIsDraftingCalendar(false);
    }
  }, [message.content, message.id, setActivePanelTab]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
      className={cn(
        "group flex gap-2 md:gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
      data-message-id={message.id}
    >
      {!isUser && (
        <div className="gc-refined-accent-surface mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border shadow-[0_10px_28px_rgba(15,118,110,0.12)] md:h-10 md:w-10">
          <OpenAIIcon className="h-3 w-3 text-primary md:h-4 md:w-4" />
        </div>
      )}

      <div className={cn("w-full max-w-full min-w-0", isUser && "order-first")}>
        <Card
          className={cn(
            "relative w-full min-w-0 gap-0 overflow-hidden break-words border px-3 py-2.5 text-left text-body-sm leading-relaxed md:px-5 md:py-4 md:text-body",
            isUser
              ? "gc-user-bubble rounded-2xl rounded-br-md md:max-w-[76%]"
              : "gc-assistant-bubble rounded-[1.6rem] rounded-bl-md text-foreground/90 md:max-w-[48rem]"
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          onContextMenu={(onEdit || onDelete) ? (e) => { e.preventDefault(); setMenuOpen(true); } : undefined}
        >
          {message.attachments && message.attachments.length > 0 && !isEditing && (
            <div className="mb-2 space-y-1.5 md:space-y-2">
              {message.attachments.some((a) => a.type === "image") && (
                <div className={cn(
                  "flex flex-wrap gap-1.5",
                  message.attachments.filter((a) => a.type === "image").length === 1 ? "max-w-[280px]" : ""
                )}>
                  {message.attachments
                    .filter((a) => a.type === "image")
                    .map((att) => (
                      /* eslint-disable-next-line @next/next/no-img-element -- data URI thumbnail */
                      <img
                        key={att.id}
                        src={att.dataUrl || att.thumbnailUrl}
                        alt={att.name}
                        className={cn(
                          "rounded-lg object-cover shadow-sm",
                          message.attachments!.filter((a) => a.type === "image").length === 1
                            ? "w-full max-h-[220px] md:max-h-[240px]"
                            : "h-16 w-16 md:h-20 md:w-20"
                        )}
                      />
                    ))}
                </div>
              )}
              {message.attachments.some((a) => a.type !== "image") && (
                <div className="flex flex-wrap gap-1.5">
                  {message.attachments
                    .filter((a) => a.type !== "image")
                    .map((att) => (
                      <div
                        key={att.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-nano md:text-micro",
                          isUser
                            ? "border-white/15 bg-white/15 text-white/90"
                            : "gc-refined-soft-surface text-foreground/75"
                        )}
                      >
                        {att.type === "pdf" ? (
                          <FileIcon className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                        <span className="max-w-[140px] truncate">{att.name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className="w-full resize-none bg-background/50 rounded-lg p-2 text-sm text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary/60 min-h-[40px]"
              />
              <p className="text-micro leading-relaxed text-muted-foreground/80">
                Ao salvar, o chat refaz a conversa a partir desta mensagem.
              </p>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-micro md:h-7 md:text-xs" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />Cancelar
                </Button>
                <Button size="sm" className="h-6 px-2 text-micro md:h-7 md:text-xs" onClick={handleSaveEdit} disabled={!editContent.trim()}>
                  <Send className="h-3 w-3 mr-1" />Enviar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {!message.isGeneratingImage && <ReasoningPanel message={message} />}
              <MessageContent message={message} />
            </>
          )}

          {message.isSearching && (
            <div className="gc-refined-soft-surface mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2.5">
              <Globe className="h-4 w-4 text-emerald-500 animate-pulse" />
              <span className="text-micro font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
                Pesquisando na web...
              </span>
              <div className="flex gap-1 ml-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.2s" }}
                  />
                ))}
              </div>
            </div>
          )}

          {message.citations && message.citations.length > 0 && (
            <div className="gc-refined-citation-surface mt-4 rounded-2xl border px-3 py-3 md:px-4">
              <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider md:text-[10px]">
                <Globe className="h-2 w-2" />
                Referências
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.citations.map((cite, i) => (
                  <a
                    key={i}
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium leading-none transition-colors md:text-[11px]",
                      "gc-refined-chip hover:border-primary/25 hover:text-primary",
                      "max-w-[180px] truncate"
                    )}
                    title={cite.url}
                  >
                    <ExternalLink className="h-1.5 w-1.5 shrink-0" />
                    {cite.title || new URL(cite.url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>

        <div className={cn(
          "mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground/60",
          isUser ? "justify-end" : "justify-start"
        )}>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
              isUser
                ? "border-white/18 bg-white/10 text-white/72"
                : "gc-refined-chip"
            )}
          >
            {formatTime(message.timestamp)}
          </span>
          {!isEditing && (onEdit || onDelete) && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={cn(
                    "rounded-full text-muted-foreground/70 hover:text-foreground",
                    "opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  )}
                >
                  <MoreHorizontal className="h-3 w-3" />
                  <span className="sr-only">Acoes da mensagem</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isUser ? "end" : "start"} className="w-52">
                {isUser && onEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                      setMenuOpen(false);
                    }}
                    className="gap-2 text-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar e refazer daqui
                  </DropdownMenuItem>
                )}
                {!isUser && message.content && (
                  <DropdownMenuItem
                    onClick={() => {
                      appendToNotes(message.content, message.id);
                      setMenuOpen(false);
                    }}
                    className="gap-2 text-xs"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    Adicionar à nota
                  </DropdownMenuItem>
                )}
                {message.content && (
                  <DropdownMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      void handleCalendarDraft();
                    }}
                    disabled={isDraftingCalendar}
                    className="gap-2 text-xs"
                  >
                    {isDraftingCalendar ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    Rascunhar agenda
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteDialogOpen(true);
                      setMenuOpen(false);
                    }}
                    className="gap-2 text-xs text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isUser ? "Excluir este turno" : "Excluir esta resposta"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!isUser &&
          (message.content ||
            (message.artifact?.kind === "document" ? message.artifact.content : "")) && (
          <div className="gc-refined-action-surface mt-2 rounded-2xl border px-2.5 py-2 md:px-3">
            <QuickActionsBar
              content={
                message.artifact?.kind === "document"
                  ? message.artifact.content
                  : message.content
              }
              messageId={message.id}
              streamStatus={message.streamStatus}
              onRegenerate={onRegenerate}
              alwaysVisible
              className="w-full justify-start"
            />
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-control)] shadow-[0_0_14px_rgba(14,116,144,0.10)] md:h-8 md:w-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- small local avatar */}
          <img
            src={USER_AVATAR_SRC}
            alt="Anders"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {onDelete && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={deleteTitle}
          description={deleteDescription}
          confirmLabel={deleteLabel}
          onConfirm={() => onDelete(message.id)}
        />
      )}
    </motion.div>
  );
}
