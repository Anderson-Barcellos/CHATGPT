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
  PanelRightOpen,
  ShieldCheck,
  MessageCircle,
  ChevronRight,
  ImageIcon,
  CircleHelp,
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

const MOBILE_CONVERSATIONS = [
  { title: "Paciente João Silva", time: "09:21", active: true },
  { title: "Relatório USG Apêndice", time: "Ontem" },
  { title: "Rotina Vesícula", time: "Ontem" },
  { title: "Dúvida Hepática", time: "17/06" },
];

const MOBILE_ACTIONS = [
  { icon: ImageIcon, label: "Analisar imagem", prompt: "Analise a seguinte imagem: " },
  { icon: FileText, label: "Criar relatório", prompt: "Crie um relatório clínico sobre " },
  { icon: Wand2, label: "Revisar texto", prompt: "Revise o seguinte texto mantendo clareza clínica:\n\n" },
  { icon: CircleHelp, label: "Perguntar algo", prompt: "Quero perguntar sobre " },
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
    <div className="flex flex-1 items-start justify-center px-[var(--gc-mobile-welcome-outer-x)] py-[var(--gc-mobile-welcome-outer-y)] md:items-center md:px-5 md:py-8">
      <div className="w-full max-w-5xl">
        <div className="space-y-5 md:hidden">
          <section>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">Conversas</h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                onClick={() => window.dispatchEvent(new CustomEvent("gaucho:open-context-panel"))}
              >
                Ver todas
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {MOBILE_CONVERSATIONS.map((conversation) => (
                <button
                  key={conversation.title}
                  type="button"
                  className={cn(
                    "flex min-h-[5.4rem] min-w-[9.2rem] flex-col justify-between rounded-2xl border bg-background/72 p-3 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)]",
                    conversation.active
                      ? "border-primary/60 bg-primary/5"
                      : "border-[color:var(--gc-border-soft)]"
                  )}
                >
                  <span className="flex items-start gap-2">
                    <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium leading-snug text-foreground">{conversation.title}</span>
                  </span>
                  <span className="pl-6 text-xs text-muted-foreground">{conversation.time}</span>
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("gaucho:open-context-panel"))}
            className="flex w-full items-center gap-3 rounded-3xl border border-[color:var(--gc-border-soft)] bg-background/78 px-4 py-3.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.06)]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--gc-border-soft)] bg-muted/48 text-foreground">
              <PanelRightOpen className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground">Painel contextual</span>
              <span className="block text-sm leading-snug text-muted-foreground">Exames, imagens, protocolos e mais</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-foreground" />
          </button>

          <section className="rounded-3xl border border-[color:var(--gc-border-soft)] bg-background/78 px-4 py-5 text-center shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
            <div className="mx-auto flex size-14 items-center justify-center rounded-3xl border border-primary/20 bg-primary/8">
              <ShieldCheck className="size-8 text-primary" />
            </div>
            <h2 className="mt-4 text-[1.72rem] font-semibold leading-tight tracking-[-0.04em] text-foreground">
              Olá, Anders
            </h2>
            <p className="mt-1.5 text-base text-muted-foreground">Como posso ajudar você hoje?</p>
            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {MOBILE_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSuggestionClick(prompt)}
                  className="inline-flex min-h-[3.35rem] flex-col items-center justify-center gap-1 rounded-2xl border border-[color:var(--gc-border-soft)] bg-background/80 px-1.5 text-[0.66rem] font-medium leading-tight text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                >
                  <Icon className="size-4 text-primary" />
                  <span className="line-clamp-2">{label}</span>
                </button>
              ))}
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Confidencial e seguro.
            </p>
          </section>

          <div className="flex items-center gap-4 px-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border/70" />
            Hoje
            <span className="h-px flex-1 bg-border/70" />
          </div>

          <section className="flex items-start gap-3 pb-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--gc-border-soft)] bg-background">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div className="rounded-[1.4rem] bg-muted/62 px-5 py-4 text-[0.95rem] leading-relaxed text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <p>Pronto para te ajudar com análises, relatórios e dúvidas clínicas.</p>
              <p className="mt-3">Qual é o tema de hoje?</p>
              <p className="mt-4 text-xs text-muted-foreground">09:21</p>
            </div>
          </section>
        </div>

        <div className="gc-refined-panel hidden rounded-[var(--gc-mobile-welcome-panel-radius)] border px-[var(--gc-mobile-welcome-panel-x)] py-[var(--gc-mobile-welcome-panel-y)] md:block md:rounded-[2rem] md:px-7 md:py-7">
          <div className="grid gap-[var(--gc-mobile-welcome-grid-gap)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)] lg:gap-9">
            <div className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-0.5 text-nano font-semibold uppercase tracking-label text-primary md:px-3 md:py-1 md:text-micro md:tracking-eyebrow">
                  <Sparkles className="h-3.5 w-3.5" />
                  Workspace clínico
                </div>

                <div className="mt-5 hidden md:inline-flex">
                  <div className="gc-refined-accent-surface rounded-[1.6rem] border p-4 shadow-[0_16px_34px_rgba(15,118,110,0.10)]">
                    <GPTLogo size={72} className="animate-float" />
                  </div>
                </div>

                <h2 className="mt-3 text-[var(--gc-mobile-welcome-title-size)] font-semibold leading-none tracking-[-0.04em] text-foreground md:mt-6 md:text-[2.6rem]">
                  {getGreeting()}, Anders.
                </h2>
                <p className="mt-2 max-w-md text-body-sm leading-relaxed text-muted-foreground md:mt-3 md:text-base">
                  {subtitle} Escolhe um ponto de partida e eu já deixo o composer pronto com o contexto inicial.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("gaucho:open-context-panel"))}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[color:var(--gc-border-soft)] bg-background/62 px-3 py-3 text-left text-body-sm leading-relaxed text-muted-foreground/86 transition-colors hover:border-primary/30 hover:bg-primary/5 md:mt-6 md:px-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <PanelRightOpen className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Painel contextual</span>
                  <span className="block text-micro">Exames, notas, Pulse e rotinas ficam ao lado da conversa.</span>
                </span>
              </button>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
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
                      <span className="block text-body-sm font-semibold leading-tight text-foreground md:text-sm">{label}</span>
                      <span className="block text-micro leading-snug text-muted-foreground/85 md:text-xs md:leading-relaxed">{desc}</span>
                    </div>
                    <span className="mt-auto inline-flex items-center rounded-full border border-[color:var(--gc-border-soft)] px-2 py-0.5 text-nano font-medium text-muted-foreground/75 md:px-2.5 md:py-1 md:text-micro">
                      Usar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-micro text-muted-foreground/70 md:mt-5 md:text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>Confidencial e seguro. Revise informacoes importantes.</span>
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
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--gc-mobile-chat-content-gap)] px-[var(--gc-mobile-chat-content-x)] py-[var(--gc-mobile-chat-content-y)] md:gap-5 md:px-5 md:py-7 lg:max-w-[50rem]">
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
