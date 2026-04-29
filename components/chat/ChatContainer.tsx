"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  { icon: Code, label: "Escrever codigo", desc: "Gere, refatore ou debug", prompt: "Me ajude a escrever um código em ", accent: "from-blue-500/20 to-indigo-500/20", iconColor: "text-blue-400" },
  { icon: Scan, label: "Analisar imagem", desc: "DICOM, exames, fotos", prompt: "Analise a seguinte imagem: ", accent: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-400" },
  { icon: Lightbulb, label: "Explicar conceito", desc: "Simples, com exemplos", prompt: "Explique de forma simples e com exemplos o conceito de ", accent: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-400" },
  { icon: Wand2, label: "Gerar imagem", desc: "Crie com DALL-E", prompt: "Gere uma imagem de ", accent: "from-rose-500/20 to-pink-500/20", iconColor: "text-rose-400" },
  { icon: FileText, label: "Resumir texto", desc: "Conciso e claro", prompt: "Resuma o seguinte texto de forma clara e concisa:\n\n", accent: "from-cyan-500/20 to-teal-500/20", iconColor: "text-cyan-400" },
  { icon: Languages, label: "Traduzir", desc: "Qualquer idioma", prompt: "Traduza o seguinte texto para ", accent: "from-emerald-500/20 to-green-500/20", iconColor: "text-emerald-400" },
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
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 md:px-4 md:py-16">
      <div className="relative mb-4 md:mb-6">
        <GPTLogo size={120} className="animate-float" />
        <div className="absolute -inset-6 -z-10 rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-indigo-500/15 blur-3xl md:-inset-8" />
      </div>

      <h2 className="mb-1.5 text-[1.7rem] font-semibold tracking-tight md:mb-2 md:text-4xl">
        <span className="text-gradient-gpt">GPT</span>
      </h2>
      <p className="mb-7 max-w-[18rem] text-center text-sm text-muted-foreground/80 md:mb-10 md:max-w-sm md:text-base">
        {getGreeting()}, Anders! {subtitle}
      </p>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3">
        {SUGGESTIONS.map(({ icon: Icon, label, desc, prompt, accent, iconColor }) => (
          <button
            key={label}
            onClick={() => onSuggestionClick(prompt)}
            className={cn(
              "group flex flex-col items-start gap-1.5 rounded-xl border border-white/10 p-3 text-left md:gap-2 md:rounded-2xl md:p-4",
              "glass-hover",
              "transition-all duration-200",
              "hover:shadow-lg hover:shadow-primary/10",
              "active:scale-[0.98]"
            )}
          >
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br md:h-9 md:w-9 md:rounded-xl", accent)}>
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <span className="text-[13px] font-semibold md:text-sm">{label}</span>
            <span className="text-xs text-muted-foreground/80 leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      <div className="mt-7 flex items-center gap-2 text-[11px] text-muted-foreground/60 md:mt-10 md:text-xs">
        <Sparkles className="h-3 w-3" />
        <span>Com tecnologia OpenAI</span>
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

export function ChatContainer({
  messages,
  isLoading,
  editAndResend,
  deleteMessage,
}: ChatContainerProps) {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isTrackingBottomRef = useRef(true);
  const initialLoadCompleteRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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
    } else if (snapshot.isNearBottom) {
      isTrackingBottomRef.current = true;
    }

    setShowScrollBtn((current) =>
      current === snapshot.shouldShowScrollButton
        ? current
        : snapshot.shouldShowScrollButton
    );
  }, [getViewport, messages.length]);

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
    scheduleScrollStateSync();
  }, [activeConversationId, scheduleScrollStateSync]);

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
      return;
    }

    initialLoadCompleteRef.current = true;
    scheduleScrollStateSync();
  }, [getViewport, isLoading, messages, scheduleScrollStateSync, scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
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
  }, [getViewport, scrollToBottom, syncScrollState]);

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
        <div ref={contentRef} className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 md:gap-6 md:px-4 md:py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSuggestion} />
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={getChatMessageRenderKey(message)}
                message={message}
                onEdit={editAndResend}
                onDelete={deleteMessage}
              />
            ))
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
            setShowScrollBtn(false);
            scrollToBottom("smooth");
          }}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
