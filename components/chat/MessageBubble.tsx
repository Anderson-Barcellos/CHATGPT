"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageContent } from "./MessageContent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { User, ChevronDown, Brain, Pencil, X, Send, ImagePlus, Globe, ExternalLink, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OpenAIIcon } from "@/components/ui/icons";
import { MessageActions } from "@/components/chat/MessageActions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MessageBubbleProps {
  message: Message;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
}

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
        "group flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
          <OpenAIIcon className="h-4 w-4 text-primary" />
        </div>
      )}

      <div className={cn("max-w-[95%] sm:max-w-[80%] min-w-0", isUser && "order-first")}>
        <Card
          className={cn(
            "relative px-4 py-3 text-[13px] leading-relaxed text-left overflow-hidden",
            isUser
              ? "bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 rounded-2xl rounded-br-md"
              : "glass text-foreground/90 rounded-2xl rounded-bl-md"
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          onContextMenu={(onEdit || onDelete) ? (e) => { e.preventDefault(); setMenuOpen(true); } : undefined}
        >
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
              <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                Ao salvar, o chat refaz a conversa a partir desta mensagem.
              </p>
              <div className="flex justify-end gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />Cancelar
                </Button>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit} disabled={!editContent.trim()}>
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
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
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
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium",
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

          {message.reasoningSummary !== undefined && message.reasoningSummary !== null && (
            <div className="mt-3">
              {message.reasoningSummary.trim().length === 0 && !message.content && !message.imageBase64 ? (
                <div className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 border",
                  message.isGeneratingImage
                    ? "bg-violet-500/10 border-violet-500/20"
                    : "bg-cyan-500/10 border-cyan-500/20"
                )}>
                  {message.isGeneratingImage ? (
                    <ImagePlus className="h-4 w-4 text-violet-500 animate-pulse" />
                  ) : (
                    <Brain className="h-4 w-4 text-cyan-500 animate-pulse" />
                  )}
                  <span className={cn(
                    "text-xs font-medium animate-pulse",
                    message.isGeneratingImage
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-cyan-600 dark:text-cyan-400"
                  )}>
                    {message.isGeneratingImage ? "Gerando imagem..." : "Raciocinando..."}
                  </span>
                  <div className="flex gap-1 ml-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full animate-bounce",
                          message.isGeneratingImage ? "bg-violet-500/60" : "bg-cyan-500/60"
                        )}
                        style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.2s" }}
                      />
                    ))}
                  </div>
                </div>
              ) : message.reasoningSummary.trim().length > 0 ? (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto w-full justify-between p-2 text-xs hover:bg-muted/50 gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-cyan-500" />
                        Raciocinio (resumo)
                      </div>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {message.reasoningSummary}
                    </ReactMarkdown>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </div>
          )}

          {message.reasoningText && message.reasoningText.trim().length > 0 && (
            <Collapsible className="mt-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-between p-2 text-xs hover:bg-muted/50 gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-cyan-500" />
                    Raciocinio (completo)
                  </div>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {message.reasoningText}
                </ReactMarkdown>
              </CollapsibleContent>
            </Collapsible>
          )}
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
          {!isUser && message.content && (
            <MessageActions
              content={message.content}
              className="opacity-70 transition-opacity md:opacity-0 md:group-hover:opacity-100"
            />
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
          <User className="h-4 w-4 text-primary" />
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
