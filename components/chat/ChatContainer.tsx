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

const SUGGESTIONS = [
  { icon: Code, label: "Escrever código", desc: "Gere, refatore ou debug", prompt: "Me ajude a escrever um código em " },
  { icon: Scan, label: "Analisar imagem", desc: "DICOM, exames, fotos", prompt: "Analise a seguinte imagem: " },
  { icon: Lightbulb, label: "Explicar conceito", desc: "Simples, com exemplos", prompt: "Explique de forma simples e com exemplos o conceito de " },
  { icon: Wand2, label: "Gerar imagem", desc: "Crie com DALL-E", prompt: "Gere uma imagem de " },
  { icon: FileText, label: "Resumir texto", desc: "Conciso e claro", prompt: "Resuma o seguinte texto de forma clara e concisa:\n\n" },
  { icon: Languages, label: "Traduzir", desc: "Qualquer idioma", prompt: "Traduza o seguinte texto para " },
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
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 md:py-16">
      <div className="relative mb-5">
        <GPTLogo size={120} className="animate-float" />
        <div className="absolute -inset-4 -z-10 rounded-full bg-cyan-500/10 blur-2xl" />
      </div>

      <h2 className="mb-2 text-3xl md:text-4xl font-semibold tracking-tight">
        <span className="text-gradient-gpt">GPT</span>
      </h2>
      <p className="mb-10 max-w-sm text-center text-base text-muted-foreground/80">
        {getGreeting()}, Anders! Bora criar algo bonito hoje?
      </p>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, label, desc, prompt }) => (
          <button
            key={label}
            onClick={() => onSuggestionClick(prompt)}
            className={cn(
              "group flex flex-col items-start gap-2 rounded-2xl border border-white/10 p-4 text-left",
              "glass-hover",
              "transition-all duration-200",
              "hover:shadow-lg hover:shadow-cyan-500/10",
              "active:scale-[0.98]"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-indigo-500/20">
              <Icon className="h-4 w-4 text-cyan-500" />
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    const container = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSuggestion} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} onEdit={editAndResend} onDelete={deleteMessage} />
            ))
          )}

          {isLoading && <TypingIndicator />}

          <div ref={scrollRef} />
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
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
