"use client";

import { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  Copy,
  Download,
  LoaderCircle,
  MessageSquareQuote,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  StickyNote,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn } from "@/components/motion/FadeIn";
import { useAssistantTts } from "@/hooks/useAssistantTts";
import { useRealtimeTtsLab } from "@/hooks/useRealtimeTtsLab";
import { useNotes } from "@/hooks/useNotes";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import type { MessageStreamStatus } from "@/types";

interface QuickActionsBarProps {
  content: string;
  messageId: string;
  streamStatus?: MessageStreamStatus;
  onRegenerate?: () => void;
  className?: string;
  alwaysVisible?: boolean;
}

function ActionButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TtsPlayer({
  tts,
  realtime,
  realtimePanelOpen,
  onRealtimeToggle,
}: {
  tts: ReturnType<typeof useAssistantTts>;
  realtime: ReturnType<typeof useRealtimeTtsLab>;
  realtimePanelOpen: boolean;
  onRealtimeToggle: () => void;
}) {
  const shouldShowTtsPlayer = tts.isOpen;
  const shouldShowRealtimePlayer = realtimePanelOpen || realtime.status !== "idle";

  if (!shouldShowTtsPlayer && !shouldShowRealtimePlayer) return null;

  const isLoading = tts.status === "loading";
  const realtimeIsStarting =
    realtime.status === "connecting" || realtime.status === "ready";
  const realtimeIsLive = realtime.status === "speaking";
  const realtimeStatusLabel = realtime.error
    ? realtime.error
    : realtime.status === "idle"
    ? "Pronto para testar a voz em tempo real"
    : realtime.status === "connecting"
    ? "Conectando sessão WebRTC..."
    : realtime.status === "ready"
    ? "Sessão pronta, solicitando áudio..."
    : realtime.status === "speaking"
    ? realtime.firstAudioMs
      ? `Recebendo áudio ao vivo · 1º áudio ${realtime.firstAudioMs}ms`
      : "Recebendo áudio ao vivo"
    : realtime.status === "completed"
    ? realtime.firstAudioMs
      ? `Leitura concluída · 1º áudio ${realtime.firstAudioMs}ms`
      : "Leitura concluída"
    : "Falha no Realtime mini";

  return (
    <div className="mt-1.5 w-full max-w-[320px] rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2 py-1.5 text-muted-foreground shadow-sm">
      {shouldShowTtsPlayer && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={tts.togglePlay}
            disabled={isLoading && !tts.isPlaying}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/80 text-foreground hover:bg-background disabled:opacity-50"
            title={tts.isPlaying ? "Pausar" : "Tocar"}
          >
            {isLoading ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : tts.isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => tts.seekBy(-15)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70"
            title="Voltar 15s"
          >
            <RotateCcw className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => tts.seekBy(15)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70"
            title="Avançar 15s"
          >
            <RotateCw className="size-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${tts.progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none">
              <span>{tts.formattedCurrentTime}</span>
              <span className="truncate">
                {tts.error || `Parte ${tts.clipIndex + 1}/${tts.totalClips}`}
              </span>
              <span>{tts.formattedDuration}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={tts.stop}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70"
            title="Parar"
          >
            <Square className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={tts.downloadAudio}
            disabled={!tts.canDownload}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70 disabled:pointer-events-none disabled:opacity-40"
            title={
              tts.canDownload
                ? "Baixar áudio completo"
                : "Download completo disponível apenas em MP3"
            }
          >
            <Download className="size-3.5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between gap-2 text-[10px] leading-none",
          shouldShowTtsPlayer &&
            "mt-1.5 border-t border-[color:var(--gc-border-soft)] pt-1.5",
        )}
      >
        <button
          type="button"
          onClick={onRealtimeToggle}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 font-medium text-foreground hover:bg-background",
            realtimeIsLive
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-background/70",
          )}
          title={
            realtime.isActive
              ? "Parar leitura Realtime mini"
              : "Tocar com Realtime mini"
          }
        >
          {realtimeIsStarting ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : realtime.isActive ? (
            <Square className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
          {realtime.isActive ? "Parar Realtime" : "Tocar Realtime"}
        </button>
        <span className="min-w-0 truncate text-muted-foreground/80">
          {realtimeStatusLabel}
        </span>
      </div>
    </div>
  );
}

export function QuickActionsBar({
  content,
  messageId,
  streamStatus,
  onRegenerate,
  className,
  alwaysVisible = false,
}: QuickActionsBarProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);
  const [realtimePanelOpen, setRealtimePanelOpen] = useState(false);
  const touchTimer = useRef<number | undefined>(undefined);
  const tts = useAssistantTts(content, messageId);
  const realtime = useRealtimeTtsLab(content);

  const handleTouchStart = useCallback(() => {
    if (!isMobile) return;
    setTouched(true);
    window.clearTimeout(touchTimer.current);
    touchTimer.current = window.setTimeout(() => setTouched(false), 2000);
  }, [isMobile]);
  const { appendToNotes } = useNotes();
  const { setActivePanelTab } = useUIStore();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não consegui copiar.");
    }
  }, [content]);

  const handleNote = useCallback(() => {
    appendToNotes(content, messageId);
    setActivePanelTab("notes");
  }, [content, messageId, appendToNotes, setActivePanelTab]);

  const handlePulseDraft = useCallback(() => {
    setActivePanelTab("pulse");
    window.dispatchEvent(
      new CustomEvent("gaucho:pulse-draft-from-text", { detail: { text: content } })
    );
  }, [content, setActivePanelTab]);

  const handleQuote = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:quote-text", { detail: { text: content } }),
    );
  }, [content]);

  const handleRealtimeToggle = useCallback(() => {
    setRealtimePanelOpen(true);

    if (realtime.isActive) {
      realtime.stop();
      return;
    }

    tts.stop();
    void realtime.start();
  }, [realtime, tts]);

  const handleContinue = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", { detail: { text: "Continue." } }),
    );
  }, []);

  const handleShorten = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("gaucho:send-message", {
        detail: { text: "Encurte a resposta acima." },
      }),
    );
  }, []);

  if (streamStatus === "streaming") return null;

  const bar = (
    <div
      onTouchStart={handleTouchStart}
      className={cn(
        "flex items-center gap-0.5",
        alwaysVisible
          ? "opacity-100"
          : isMobile
          ? touched ? "opacity-100" : "opacity-55 transition-opacity"
          : "opacity-0 transition-opacity group-hover:opacity-100",
        className,
      )}
    >
      <ActionButton onClick={handleCopy} title="Copiar">
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </ActionButton>
      {onRegenerate && (
        <ActionButton onClick={onRegenerate} title="Regenerar">
          <RefreshCw className="size-3.5" />
        </ActionButton>
      )}
      <ActionButton
        onClick={tts.openAndPlay}
        title="Ler em voz alta"
        disabled={!tts.canPlay}
      >
        <Volume2 className="size-3.5" />
      </ActionButton>
      <ActionButton
        onClick={handleRealtimeToggle}
        title={realtime.isActive ? "Parar Realtime mini" : "Tocar Realtime mini"}
        disabled={!tts.canPlay}
      >
        {realtime.status === "connecting" || realtime.status === "ready" ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : realtime.isActive ? (
          <Square className="size-3.5" />
        ) : (
          <Radio className="size-3.5" />
        )}
      </ActionButton>
      <ActionButton onClick={handleContinue} title="Continuar">
        <ArrowDown className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleShorten} title="Encurtar">
        <Minimize2 className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleNote} title="Adicionar à nota">
        <StickyNote className="size-3.5" />
      </ActionButton>
      <ActionButton
        onClick={handlePulseDraft}
        title="Criar Pulse"
        disabled={content.trim().length === 0}
      >
        <Sparkles className="size-3.5" />
      </ActionButton>
      <ActionButton onClick={handleQuote} title="Citar no composer">
        <MessageSquareQuote className="size-3.5" />
      </ActionButton>
    </div>
  );

  const wrappedBar = (
    <div className={cn("flex flex-col items-start", className)}>
      {bar}
      <TtsPlayer
        tts={tts}
        realtime={realtime}
        realtimePanelOpen={realtimePanelOpen}
        onRealtimeToggle={handleRealtimeToggle}
      />
    </div>
  );

  if (
    streamStatus === "completed" ||
    streamStatus === "interrupted" ||
    streamStatus === "aborted" ||
    streamStatus === "failed"
  ) {
    return <FadeIn delay={0.3}>{wrappedBar}</FadeIn>;
  }

  return wrappedBar;
}
