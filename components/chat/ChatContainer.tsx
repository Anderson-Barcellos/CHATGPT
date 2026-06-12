"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Code,
  FileText,
  Lightbulb,
  Languages,
  ArrowDown,
  Scan,
  Wand2,
} from "lucide-react";
import { GPTLogo } from "@/components/ui/gpt-logo";
import {
  AUTO_SCROLL_THRESHOLD,
  deriveScrollState,
  getDistanceFromBottom,
  shouldAutoScroll,
} from "@/lib/chat/scrollState";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import { Message } from "@/types";

const SUGGESTIONS = [
  { icon: Code, label: "Escrever codigo", desc: "Gere, refatore ou debug", prompt: "Me ajude a escrever um código em ", accent: "from-primary/20 to-accent/10", iconColor: "text-primary" },
  { icon: Scan, label: "Analisar imagem", desc: "DICOM, exames, fotos", prompt: "Analise a seguinte imagem: ", accent: "from-accent/20 to-primary/10", iconColor: "text-accent" },
  { icon: Lightbulb, label: "Explicar conceito", desc: "Simples, com exemplos", prompt: "Explique de forma simples e com exemplos o conceito de ", accent: "from-amber-500/20 to-primary/10", iconColor: "text-amber-600 dark:text-amber-300" },
  { icon: Wand2, label: "Gerar imagem", desc: "Crie com DALL-E", prompt: "Gere uma imagem de ", accent: "from-rose-500/20 to-primary/10", iconColor: "text-rose-600 dark:text-rose-300" },
  { icon: FileText, label: "Resumir texto", desc: "Conciso e claro", prompt: "Resuma o seguinte texto de forma clara e concisa:\n\n", accent: "from-primary/20 to-accent/10", iconColor: "text-primary" },
  { icon: Languages, label: "Traduzir", desc: "Qualquer idioma", prompt: "Traduza o seguinte texto para ", accent: "from-emerald-500/20 to-accent/10", iconColor: "text-emerald-700 dark:text-emerald-300" },
];

const SUBTITLES = [
  "Bora criar algo bonito hoje?",
  "No que posso te ajudar?",
  "Pronto pra mais um dia produtivo!",
  "O que vamos construir hoje?",
  "Estou aqui pra qualquer coisa!",
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

interface WelcomeScreenProps {
  onSuggestionClick: (prompt: string) => void;
}

function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  const [subtitle] = useState(
    () => SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)]
  );

  return (
    <div className="flex flex-1 items-start justify-center px-[var(--gc-mobile-welcome-outer-x)] py-[var(--gc-mobile-welcome-outer-y)] md:items-center md:px-4 md:py-10">
      <div className="w-full max-w-5xl">
        <div className="gc-refined-panel rounded-[var(--gc-mobile-welcome-panel-radius)] border px-[var(--gc-mobile-welcome-panel-x)] py-[var(--gc-mobile-welcome-panel-y)] md:rounded-[2rem] md:px-7 md:py-7">
          <div className="grid gap-[var(--gc-mobile-welcome-grid-gap)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.45fr)] lg:gap-8">
            <div className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary md:px-3 md:py-1 md:text-[11px] md:tracking-[0.22em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Workspace clínico
                </div>

                <div className="relative mt-5 hidden md:inline-flex">
                  <div className="gc-refined-accent-surface rounded-[1.8rem] border p-4 shadow-[0_20px_40px_rgba(15,118,110,0.14)]">
                    <GPTLogo size={72} className="animate-float" />
                  </div>
                  <div className="absolute -inset-6 -z-10 rounded-full bg-gradient-to-br from-primary/20 via-accent/10 to-primary/10 blur-3xl" />
                </div>

                <h2 className="mt-3 text-[var(--gc-mobile-welcome-title-size)] font-semibold leading-none tracking-[-0.04em] text-foreground md:mt-6 md:text-[2.6rem]">
                  {getGreeting()}, Anders.
                </h2>
                <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground md:mt-3 md:text-base">
                  {subtitle} Escolhe um ponto de partida e eu já deixo o composer pronto com o contexto inicial.
                </p>
              </div>

              <div className="mt-3 rounded-2xl border border-[color:var(--gc-border-soft)] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground/80 dark:bg-white/[0.02] md:mt-6 md:px-4 md:py-3 md:text-xs">
                O Gaucho Chat combina chat, leitura clínica e memória operacional no mesmo workspace.
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.20em] text-muted-foreground">
                    Sugestões de partida
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolhe um atalho e seguimos dali.
                  </p>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-[var(--gc-mobile-welcome-suggestion-gap)] md:gap-2.5 2xl:grid-cols-3">
                {SUGGESTIONS.map(({ icon: Icon, label, desc, prompt, accent, iconColor }) => (
                  <button
                    key={label}
                    onClick={() => onSuggestionClick(prompt)}
                    className={cn(
                      "gc-refined-panel group flex min-h-[var(--gc-mobile-welcome-suggestion-min-height)] flex-col items-start gap-[var(--gc-mobile-welcome-suggestion-gap)] rounded-[1rem] border p-[var(--gc-mobile-welcome-suggestion-pad)] text-left transition-all duration-200 md:min-h-[10.5rem] md:gap-3 md:rounded-[1.4rem] md:p-4",
                      "hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,118,110,0.10)]",
                      "active:scale-[0.99]"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_10px_24px_rgba(15,118,110,0.08)] md:h-10 md:w-10 md:rounded-2xl", accent)}>
                      <Icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", iconColor)} />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[13px] font-semibold leading-tight text-foreground md:text-sm">{label}</span>
                      <span className="block text-[11px] leading-snug text-muted-foreground/85 md:text-xs md:leading-relaxed">{desc}</span>
                    </div>
                    <span className="mt-auto inline-flex items-center rounded-full border border-[color:var(--gc-border-soft)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground/75 md:px-2.5 md:py-1 md:text-[11px]">
                      Usar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-micro text-muted-foreground/60 md:mt-5 md:text-xs">
          <Sparkles className="h-3 w-3" />
          <span>Com tecnologia OpenAI</span>
        </div>
      </div>
    </div>
  );
}

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

export function getChatMessageRenderKey(message: Message): string {
  return message.id;
}

function getLatestMessageMarker(message: Message | undefined): string {
  if (!message) return "";

  return [
    message.id,
    message.streamStatus ?? "completed",
    message.reasoningStatus ?? "",
    message.content.length,
    message.reasoningSummary?.length ?? 0,
    message.reasoningText?.length ?? 0,
    message.artifact?.id ?? "",
    message.imageBase64 ? "img" : "",
  ].join(":");
}

export function ChatContainer({
  messages,
  isLoading,
  editAndResend,
  deleteMessage,
}: ChatContainerProps) {
  const regenerateLastMessage = useCallback(() => {
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const beforeAssistant = messages.slice(0, messages.length - 1 - lastAssistantIdx);
    const lastUserMsg = [...beforeAssistant].reverse().find((m) => m.role === "user");
    if (!lastUserMsg?.content?.trim()) return;
    void editAndResend(lastUserMsg.id, lastUserMsg.content);
  }, [messages, editAndResend]);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isTrackingBottomRef = useRef(true);
  const initialLoadCompleteRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);
  const latestMessageMarkerRef = useRef<string>("");
  const pendingUnreadRef = useRef(false);

  const queueUnreadReset = useCallback(() => {
    window.requestAnimationFrame(() => {
      setHasUnreadUpdates(false);
    });
  }, []);

  const getViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    ) ?? null;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = getViewport();
      if (!container) return;

      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        if (behavior === "smooth") {
          container.scrollTo({
            top: container.scrollHeight,
            behavior,
          });
        } else {
          container.scrollTop = container.scrollHeight;
        }
        scrollFrameRef.current = null;
      });
    },
    [getViewport]
  );

  const syncScrollState = useCallback(() => {
    const container = getViewport();
    if (!container) return;

    const snapshot = deriveScrollState({
      distanceFromBottom: getDistanceFromBottom(container),
      hasMessages: messages.length > 0,
      isTrackingBottom: isTrackingBottomRef.current,
      initialLoadComplete: initialLoadCompleteRef.current,
    });

    if (snapshot.mode === "reading-history") {
      isTrackingBottomRef.current = false;
      if (pendingUnreadRef.current) {
        pendingUnreadRef.current = false;
        setHasUnreadUpdates(true);
      }
    } else if (snapshot.isNearBottom) {
      isTrackingBottomRef.current = true;
      queueUnreadReset();
      pendingUnreadRef.current = false;
    }

    setShowScrollBtn((current) =>
      current === snapshot.shouldShowScrollButton
        ? current
        : snapshot.shouldShowScrollButton
    );
  }, [getViewport, messages.length, queueUnreadReset]);

  const scheduleScrollStateSync = useCallback(() => {
    if (syncFrameRef.current !== null) {
      cancelAnimationFrame(syncFrameRef.current);
    }

    syncFrameRef.current = window.requestAnimationFrame(() => {
      syncScrollState();
      syncFrameRef.current = null;
    });
  }, [syncScrollState]);

  useEffect(() => {
    initialLoadCompleteRef.current = false;
    isTrackingBottomRef.current = true;
    latestMessageMarkerRef.current = "";
    pendingUnreadRef.current = false;
    queueUnreadReset();
    scheduleScrollStateSync();
  }, [activeConversationId, queueUnreadReset, scheduleScrollStateSync]);

  useEffect(() => {
    const container = getViewport();
    if (!container) return;

    scheduleScrollStateSync();

    const handleScroll = () => syncScrollState();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => container.removeEventListener("scroll", handleScroll);
  }, [getViewport, scheduleScrollStateSync, syncScrollState]);

  useEffect(() => {
    if (messages.length === 0) {
      initialLoadCompleteRef.current = true;
      isTrackingBottomRef.current = true;
      latestMessageMarkerRef.current = "";
      pendingUnreadRef.current = false;
      queueUnreadReset();
      scheduleScrollStateSync();
      return;
    }

    const container = getViewport();
    const distanceFromBottom = container ? getDistanceFromBottom(container) : 0;
    const snapshot = deriveScrollState({
      distanceFromBottom,
      hasMessages: messages.length > 0,
      isTrackingBottom: isTrackingBottomRef.current,
      initialLoadComplete: initialLoadCompleteRef.current,
    });
    const lastMessage = messages[messages.length - 1];
    const forceAutoScroll = !initialLoadCompleteRef.current || lastMessage?.role === "user";

    if (
      shouldAutoScroll({
        initialLoadComplete: initialLoadCompleteRef.current,
        isTrackingBottom: isTrackingBottomRef.current,
        isNearBottom: snapshot.isNearBottom,
        force: forceAutoScroll,
      })
    ) {
      scrollToBottom("auto");
      isTrackingBottomRef.current = true;
      initialLoadCompleteRef.current = true;
      pendingUnreadRef.current = false;
      queueUnreadReset();
      latestMessageMarkerRef.current = getLatestMessageMarker(lastMessage);
      return;
    }

    const latestMarker = getLatestMessageMarker(lastMessage);
    if (
      initialLoadCompleteRef.current &&
      snapshot.mode === "reading-history" &&
      latestMarker !== latestMessageMarkerRef.current
    ) {
      pendingUnreadRef.current = true;
    }

    latestMessageMarkerRef.current = latestMarker;

    initialLoadCompleteRef.current = true;
    scheduleScrollStateSync();
  }, [
    getViewport,
    isLoading,
    messages,
    queueUnreadReset,
    scheduleScrollStateSync,
    scrollToBottom,
  ]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (messages.length === 0) {
        syncScrollState();
        return;
      }

      const container = getViewport();
      const isNearBottom = container
        ? getDistanceFromBottom(container) <= AUTO_SCROLL_THRESHOLD
        : true;

      if (
        shouldAutoScroll({
          initialLoadComplete: initialLoadCompleteRef.current,
          isTrackingBottom: isTrackingBottomRef.current,
          isNearBottom,
        })
      ) {
        scrollToBottom("auto");
      } else {
        syncScrollState();
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [getViewport, messages.length, scrollToBottom, syncScrollState]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
      if (syncFrameRef.current !== null) {
        cancelAnimationFrame(syncFrameRef.current);
      }
    };
  }, []);

  const handleSuggestion = useCallback((prompt: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
    if (textarea) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(textarea, prompt);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
    }
  }, []);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--gc-mobile-chat-content-gap)] px-[var(--gc-mobile-chat-content-x)] py-[var(--gc-mobile-chat-content-y)] md:gap-5 md:px-5 md:py-7 lg:max-w-[54rem]">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSuggestion} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((message, idx) => {
                const isLastAssistant =
                  message.role === "assistant" &&
                  !isLoading &&
                  idx === messages.length - 1;
                return (
                  <MessageBubble
                    key={getChatMessageRenderKey(message)}
                    message={message}
                    onEdit={editAndResend}
                    onDelete={deleteMessage}
                    onRegenerate={isLastAssistant ? regenerateLastMessage : undefined}
                  />
                );
              })}
            </AnimatePresence>
          )}

          {isLoading &&
            !(
              messages.at(-1)?.role === "assistant" &&
              (messages.at(-1)?.streamStatus === "streaming" ||
                messages.at(-1)?.reasoningStatus === "thinking")
            ) && <TypingIndicator />}
        </div>
      </ScrollArea>

      {showScrollBtn && messages.length > 0 && (
        <Button
          size="icon"
          variant="secondary"
          className={cn(
            "absolute bottom-3 left-1/2 -translate-x-1/2 z-10 md:bottom-4",
            "h-9 w-9 rounded-full shadow-lg md:h-10 md:w-10",
            "bg-background/90 backdrop-blur-sm border",
            "transition-all duration-200 hover:scale-110"
          )}
          onClick={() => {
            isTrackingBottomRef.current = true;
            pendingUnreadRef.current = false;
            setShowScrollBtn(false);
            setHasUnreadUpdates(false);
            scrollToBottom("smooth");
          }}
        >
          <ArrowDown className="h-4 w-4" />
          {hasUnreadUpdates && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-primary" />
          )}
          <span className="sr-only">Ir para mensagens mais recentes</span>
        </Button>
      )}
    </div>
  );
}
