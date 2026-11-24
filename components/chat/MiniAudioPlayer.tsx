"use client";

import { useCallback, useState } from "react";
import {
  Download,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  X,
} from "lucide-react";
import { useAssistantTts } from "@/hooks/useAssistantTts";
import { useGrokMessageRealtime } from "@/hooks/useGrokMessageRealtime";
import { useOpenAILiveSpeech } from "@/hooks/useOpenAILiveSpeech";
import { cn } from "@/lib/utils";

export type AudioEngine = "standard" | "realtime" | "openai-live";

interface MiniAudioPlayerProps {
  content: string;
  messageId: string;
  onClose: () => void;
  /** Mantém o Realtime disponível nas superfícies de conversa; o feed é TTS de arquivo. */
  allowRealtime?: boolean;
  allowOpenAILive?: boolean;
  className?: string;
}

function PlayerButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MiniAudioPlayer({
  content,
  messageId,
  onClose,
  allowRealtime = true,
  allowOpenAILive = allowRealtime,
  className,
}: MiniAudioPlayerProps) {
  const [engine, setEngine] = useState<AudioEngine>("standard");
  const tts = useAssistantTts(content, messageId);
  const realtime = useGrokMessageRealtime(content);
  const live = useOpenAILiveSpeech();
  const activeRealtime = engine === "openai-live" ? live : realtime;

  const stopAll = useCallback(() => {
    tts.stop();
    realtime.stop();
    live.stop();
  }, [live, realtime, tts]);

  const selectEngine = useCallback(
    (nextEngine: AudioEngine) => {
      if (nextEngine === engine) return;
      stopAll();
      setEngine(nextEngine);
    },
    [engine, stopAll]
  );

  const toggleSelectedEngine = useCallback(() => {
    if (engine === "standard" || !allowRealtime) {
      realtime.stop();
      live.stop();
      tts.togglePlay();
      return;
    }

    tts.stop();
    if (activeRealtime.isActive) {
      activeRealtime.stop();
      return;
    }
    if (engine === "openai-live") void live.start({ text: content });
    else void realtime.start();
  }, [activeRealtime, allowRealtime, content, engine, live, realtime, tts]);

  const close = useCallback(() => {
    stopAll();
    onClose();
  }, [onClose, stopAll]);

  const isStandard = engine === "standard";
  const isLoading = isStandard
    ? tts.status === "loading"
    : activeRealtime.status === "connecting" || activeRealtime.status === "ready";
  const isPlaying = isStandard ? tts.isPlaying : activeRealtime.isActive;
  const realtimeStatus = activeRealtime.error
    ? activeRealtime.error
    : activeRealtime.status === "completed"
      ? "Leitura concluída"
      : activeRealtime.firstAudioMs
        ? `Primeiro áudio em ${activeRealtime.firstAudioMs}ms`
        : activeRealtime.status === "idle"
        ? engine === "openai-live" ? "Pronto · cada trecho é conferido antes de tocar" : "Pronto para baixa latência"
        : activeRealtime.status === "connecting"
          ? "Conectando sessão..."
          : activeRealtime.status === "ready"
            ? "Sessão pronta..."
            : activeRealtime.status === "speaking"
              ? "Recebendo áudio ao vivo"
              : "Não foi possível iniciar o Realtime";

  return (
    <div
      className={cn(
        "mt-1.5 w-full max-w-[340px] rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2 py-1.5 text-muted-foreground shadow-sm",
        className
      )}
      data-audio-engine={engine}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-[color:var(--gc-border-soft)] pb-1.5">
        {allowRealtime ? (
          <div
            role="group"
            aria-label="Motor de áudio"
            className="flex min-w-0 flex-wrap items-center rounded-lg bg-background/55 p-0.5 text-micro md:text-nano"
          >
            <button
              type="button"
              aria-label="Escolher Grok TTS com voz Orion"
              aria-pressed={isStandard}
              onClick={() => selectEngine("standard")}
              className={cn(
                "h-6 whitespace-nowrap rounded-md px-1.5 transition-colors",
                isStandard
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Grok TTS · Orion
            </button>
            <button
              type="button"
              aria-label="Escolher Grok Realtime"
              aria-pressed={engine === "realtime"}
              onClick={() => selectEngine("realtime")}
              className={cn(
                "h-6 whitespace-nowrap rounded-md px-1.5 transition-colors",
                engine === "realtime"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Grok Realtime
            </button>
            {allowOpenAILive && (
              <button
                type="button"
                aria-label="Escolher OpenAI Live 1.1"
                aria-pressed={engine === "openai-live"}
                onClick={() => selectEngine("openai-live")}
                className={cn(
                  "h-6 whitespace-nowrap rounded-md px-1.5 transition-colors",
                  engine === "openai-live"
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                OpenAI Live 1.1
              </button>
            )}
          </div>
        ) : (
          <span className="text-micro font-medium text-foreground">
            Grok TTS · Orion
          </span>
        )}

        <PlayerButton title="Fechar player de áudio" onClick={close}>
          <X className="size-3.5" />
        </PlayerButton>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleSelectedEngine}
          disabled={(isLoading && !isPlaying) || !tts.canPlay}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/80 text-foreground hover:bg-background disabled:opacity-50"
          title={isPlaying ? (isStandard ? "Pausar" : "Parar") : "Tocar"}
          aria-label={isPlaying ? (isStandard ? "Pausar" : "Parar") : "Tocar"}
        >
          {isLoading ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : isPlaying ? (
            isStandard ? (
              <Pause className="size-3.5" />
            ) : (
              <Square className="size-3.5" />
            )
          ) : (
            <Play className="size-3.5" />
          )}
        </button>

        {isStandard ? (
          <>
            <PlayerButton title="Voltar 15s" onClick={() => tts.seekBy(-15)}>
              <RotateCcw className="size-3.5" />
            </PlayerButton>
            <PlayerButton title="Avançar 15s" onClick={() => tts.seekBy(15)}>
              <RotateCw className="size-3.5" />
            </PlayerButton>

            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${tts.progress}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-nano leading-none">
                <span>{tts.formattedCurrentTime}</span>
                <span className="truncate">
                  {tts.error ||
                    (tts.totalClips > 0
                      ? `Parte ${tts.clipIndex + 1}/${tts.totalClips}`
                      : "Pronto para gerar")}
                </span>
                <span>{tts.formattedDuration}</span>
              </div>
            </div>

            <PlayerButton title="Parar" onClick={tts.stop}>
              <Square className="size-3.5" />
            </PlayerButton>
            <PlayerButton
              title={
                tts.canDownload
                  ? "Baixar áudio completo"
                  : "Baixar MP3 após a geração completa"
              }
              onClick={tts.downloadAudio}
              disabled={!tts.canDownload}
            >
              <Download className="size-3.5" />
            </PlayerButton>
          </>
        ) : (
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-micro md:text-nano",
              activeRealtime.error && "text-rose-600 dark:text-rose-300"
            )}
            aria-live="polite"
          >
            {realtimeStatus}
          </p>
        )}
      </div>
    </div>
  );
}
