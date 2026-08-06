"use client";

import Image from "next/image";
import {
  AlertTriangle,
  ChevronDown,
  MoreHorizontal,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import andersAvatar from "@/public/images/anders-avatar.png";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { StreamingMarkdown } from "@/components/chat/StreamingMarkdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseApiErrorResponse } from "@/lib/api/errors";
import { MODELS } from "@/lib/models/modelConfig";
import {
  consumeStudioAssistantStream,
  StudioAssistantStreamInterruptedError,
} from "@/lib/studio/assistantStream";
import { getStudioModels } from "@/lib/studio/models";
import type {
  StudioAssistantMessage,
  StudioFile,
} from "@/lib/studio/types";
import { apiUrl, cn } from "@/lib/utils";
import styles from "@/components/studio/GauchoStudioShell.module.css";

interface StudioAssistantPanelProps {
  file: StudioFile;
  messages: StudioAssistantMessage[];
  modelId: string;
  onModelChange: (modelId: string) => void;
  onAddMessage: (
    role: StudioAssistantMessage["role"],
    content: string,
    status?: StudioAssistantMessage["status"]
  ) => string;
  onUpdateMessage: (
    id: string,
    patch: Partial<StudioAssistantMessage>
  ) => void;
  onClearMessages: () => void;
  onClose: () => void;
}

const STUDIO_MODELS = getStudioModels();

function formatMessageTime(createdAt: string) {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StudioAssistantPanel({
  file,
  messages,
  modelId,
  onModelChange,
  onAddMessage,
  onUpdateMessage,
  onClearMessages,
  onClose,
}: StudioAssistantPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isStreaming) return;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [isStreaming, messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    onClearMessages();
  }, [onClearMessages]);

  const sendPrompt = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isStreaming) return;

    const history = messages
      .filter((message) => message.status === "completed")
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    onAddMessage("user", trimmedPrompt);
    const assistantMessageId = onAddMessage("assistant", "", "streaming");
    setPrompt("");
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    try {
      const response = await fetch(apiUrl("/api/studio/assist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          model: modelId,
          file: {
            path: file.path,
            language: file.language,
            content: file.content,
          },
          history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw await parseApiErrorResponse(response);
      if (!response.body) throw new Error("Stream indisponível.");
      accumulated = await consumeStudioAssistantStream(
        response.body,
        (content) => {
          accumulated = content;
          onUpdateMessage(assistantMessageId, {
            content,
            status: "streaming",
          });
        }
      );

      if (!accumulated.trim()) {
        throw new Error("O modelo não retornou conteúdo.");
      }

      onUpdateMessage(assistantMessageId, {
        content: accumulated,
        status: "completed",
      });
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      const interrupted =
        aborted || error instanceof StudioAssistantStreamInterruptedError;
      const partialContent =
        error instanceof StudioAssistantStreamInterruptedError
          ? error.partialContent
          : accumulated;
      onUpdateMessage(assistantMessageId, {
        content: interrupted
          ? partialContent || "Resposta interrompida."
          : `Não consegui responder agora. ${
              error instanceof Error ? error.message : "Tente novamente."
            }`,
        status: interrupted ? "interrupted" : "failed",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [
    file,
    isStreaming,
    messages,
    modelId,
    onAddMessage,
    onUpdateMessage,
    prompt,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendPrompt();
      }
    },
    [sendPrompt]
  );

  return (
    <aside className={styles.assistantPanel} aria-label="Assistente de código">
      <div className={styles.assistantHeader}>
        <div>
          <h2>Assistente de código</h2>
        </div>
        <div className={styles.assistantHeaderActions}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Opções do assistente">
                <MoreHorizontal size={17} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={clearMessages}>
                <Trash2 className="mr-2 size-4" />
                Limpar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={onClose} aria-label="Recolher assistente">
            <X size={17} />
          </button>
        </div>
      </div>

      <div className={styles.assistantContextBar}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.modelButton}>
              <span>{MODELS[modelId]?.name ?? modelId}</span>
              <ChevronDown size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            {STUDIO_MODELS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => onModelChange(model.id)}
                className={cn(model.id === modelId && "bg-primary/10")}
              >
                {model.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className={styles.contextLabel}>Contexto</span>
        <span className={styles.contextFile}>{file.name}<X size={12} /></span>
      </div>

      <div className={styles.messageScroller} ref={scrollerRef}>
        {messages.length === 0 ? (
          <div className={styles.assistantEmpty}>
            O arquivo ativo entra automaticamente como contexto somente-leitura.
          </div>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={cn(
              styles.assistantMessage,
              message.role === "user" && styles.assistantMessageUser
            )}
          >
            <div className={styles.messageAvatar}>
              {message.role === "user" ? (
                <Image
                  src={andersAvatar}
                  alt="Anders"
                  width={28}
                  height={28}
                  className={styles.avatarImage}
                />
              ) : (
                <GPTLogo size={24} />
              )}
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <strong>{message.role === "user" ? "Você" : "Assistente"}</strong>
                <span>{formatMessageTime(message.createdAt)}</span>
              </div>
              {message.role === "assistant" ? (
                <>
                  <StreamingMarkdown
                    content={message.content}
                    streamStatus={message.status}
                    className={styles.studioMarkdown}
                  />
                  {message.status === "interrupted" ? (
                    <div className={styles.interruptedMessage}>
                      <AlertTriangle size={13} />
                      Resposta interrompida; o conteúdo pode estar incompleto.
                    </div>
                  ) : null}
                </>
              ) : (
                <p className={styles.userMessageText}>{message.content}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className={styles.assistantComposer}>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre este arquivo..."
          rows={2}
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={isStreaming ? stopStreaming : () => void sendPrompt()}
          disabled={!isStreaming && !prompt.trim()}
          aria-label={isStreaming ? "Parar resposta" : "Enviar pergunta"}
          className={styles.sendButton}
        >
          {isStreaming ? <Square size={15} /> : <Send size={16} />}
        </button>
      </div>
    </aside>
  );
}
