"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
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
import { cn } from "@/lib/utils";

const AUTO_SCROLL_THRESHOLD = 80;
const SCROLL_BUTTON_THRESHOLD = 120;

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
  const subtitle = SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 md:py-16">
      <div className="relative mb-6">
        <GPTLogo size={140} className="animate-float" />
        <div className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-indigo-500/15 blur-3xl" />
      </div>

      <h2 className="mb-2 text-3xl md:text-4xl font-semibold tracking-tight">
        <span className="text-gradient-gpt">GPT</span>
      </h2>
      <p className="mb-10 max-w-sm text-center text-base text-muted-foreground/80">
        {getGreeting()}, Anders! {subtitle}
      </p>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, label, desc, prompt, accent, iconColor }) => (
          <button
            key={label}
            onClick={() => onSuggestionClick(prompt)}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-2xl border border-white/10 p-4 text-left",
              "glass-hover",
              "transition-all duration-200",
              "hover:shadow-lg hover:shadow-primary/10",
              "active:scale-[0.98]"
            )}
          >
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", accent)}>
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground/80 leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground/60">
        <Sparkles className="h-3 w-3" />
        <span>Powered by OpenAI</span>
      </div>
    </div>
  );
}

export function ChatContainer() {
  const { messages, isLoading, editAndResend, deleteMessage } = useChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoScrollEnabledRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const getViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    ) ?? null;
  }, []);

  const getDistanceFromBottom = useCallback((container: HTMLDivElement) => {
    return container.scrollHeight - container.scrollTop - container.clientHeight;
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

    const distanceFromBottom = getDistanceFromBottom(container);
    const isNearBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
    const shouldShowButton =
      messages.length > 0 && distanceFromBottom > SCROLL_BUTTON_THRESHOLD;

    autoScrollEnabledRef.current = isNearBottom;
    setShowScrollBtn((current) =>
      current === shouldShowButton ? current : shouldShowButton
    );
  }, [getDistanceFromBottom, getViewport, messages.length]);

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
    const container = getViewport();
    if (!container) return;

    scheduleScrollStateSync();

    const handleScroll = () => syncScrollState();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => container.removeEventListener("scroll", handleScroll);
  }, [getViewport, scheduleScrollStateSync, syncScrollState]);

  useEffect(() => {
    if (messages.length === 0) {
      autoScrollEnabledRef.current = true;
      scheduleScrollStateSync();
      return;
    }

    if (autoScrollEnabledRef.current) {
      scrollToBottom("auto");
      return;
    }

    scheduleScrollStateSync();
  }, [isLoading, messages.length, scheduleScrollStateSync, scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (autoScrollEnabledRef.current) {
        scrollToBottom("auto");
      } else {
        syncScrollState();
      }
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom, syncScrollState]);

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
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div ref={contentRef} className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSuggestion} />
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={`${message.id}:${message.artifact?.id ?? "no-artifact"}`}
                message={message}
                onEdit={editAndResend}
                onDelete={deleteMessage}
              />
            ))
          )}

          {isLoading && <TypingIndicator />}
        </div>
      </ScrollArea>

      {showScrollBtn && messages.length > 0 && (
        <Button
          size="icon"
          variant="secondary"
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 z-10",
            "h-10 w-10 rounded-full shadow-lg",
            "bg-background/90 backdrop-blur-sm border",
            "transition-all duration-200 hover:scale-110"
          )}
          onClick={() => {
            autoScrollEnabledRef.current = true;
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
