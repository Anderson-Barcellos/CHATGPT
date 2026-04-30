"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageContent } from "./MessageContent";
import { ReasoningPanel } from "./ReasoningPanel";
import { Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Pencil, X, Send, Globe, ExternalLink, Trash2, MoreHorizontal, FileIcon, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OpenAIIcon } from "@/components/ui/icons";
import { MessageActions } from "@/components/chat/MessageActions";
import { useNotes } from "@/hooks/useNotes";
import { StickyNote } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
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

export function MessageBubble({ message, onEdit, onDelete }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { appendToNotes } = useNotes();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  return (
    <div
      className={cn(
        "group flex gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 md:gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
      data-message-id={message.id}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 md:h-8 md:w-8">
          <OpenAIIcon className="h-3 w-3 text-primary md:h-4 md:w-4" />
        </div>
      )}

      <div className={cn("max-w-[93%] min-w-0 sm:max-w-[80%]", isUser && "order-first")}>
        <Card
          className={cn(
            "relative min-w-0 gap-0 overflow-hidden break-words border px-2.5 py-2 text-left text-caption leading-relaxed md:px-4 md:py-3 md:text-body-sm",
            isUser
              ? "gc-user-bubble rounded-2xl rounded-br-md"
              : "gc-assistant-bubble rounded-2xl rounded-bl-md text-foreground/90"
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
                          "flex items-center gap-1.5 rounded-lg px-2 py-1 text-nano md:text-micro",
                          isUser
                            ? "bg-white/15 text-white/90"
                            : "bg-white/8 text-foreground/75"
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
            <MessageContent message={message} />
          )}

          {message.isSearching && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 border bg-emerald-500/10 border-emerald-500/20">
              <Globe className="h-4 w-4 text-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
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
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-nano font-semibold text-muted-foreground/70 uppercase tracking-wider">
                <Globe className="h-3 w-3" />
                Fontes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((cite, i) => (
                  <a
                    key={i}
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-nano font-medium",
                      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      "border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors",
                      "max-w-[200px] truncate"
                    )}
                    title={cite.url}
                  >
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    {cite.title || new URL(cite.url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}

          {!message.isGeneratingImage && <ReasoningPanel message={message} />}
        </Card>

        <div className={cn(
          "mt-1 px-1 flex items-center gap-2 text-xs text-muted-foreground/60",
          isUser ? "justify-end" : "justify-start"
        )}>
          <span>{formatTime(message.timestamp)}</span>
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
          {!isUser &&
            (message.content ||
              (message.artifact?.kind === "document" ? message.artifact.content : "")) && (
            <MessageActions
              content={
                message.artifact?.kind === "document"
                  ? message.artifact.content
                  : message.content
              }
              className="opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100"
            />
          )}
        </div>
      </div>

      {isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-control)] shadow-[0_0_18px_rgba(34,211,238,0.16)] md:h-8 md:w-8">
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
    </div>
  );
}
