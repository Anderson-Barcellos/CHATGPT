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
import { useRealtimeTtsLab } from "@/hooks/useRealtimeTtsLab";
import { cn } from "@/lib/utils";

export type AudioEngine = "standard" | "realtime";

interface MiniAudioPlayerProps {
  content: string;
  messageId: string;
  onClose: () => void;
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
  className,
}: MiniAudioPlayerProps) {
  const [engine, setEngine] = useState<AudioEngine>("standard");
  const tts = useAssistantTts(content, messageId);
  const realtime = useRealtimeTtsLab(content);

  const stopAll = useCallback(() => {
    tts.stop();
    realtime.stop();
  }, [realtime, tts]);

  const selectEngine = useCallback(
    (nextEngine: AudioEngine) => {
      if (nextEngine === engine) return;
      stopAll();
      setEngine(nextEngine);
    },
    [engine, stopAll]
  );

  const toggleSelectedEngine = useCallback(() => {
    if (engine === "standard") {
      realtime.stop();
      tts.togglePlay();
      return;
    }

    tts.stop();
    if (realtime.isActive) {
      realtime.stop();
      return;
    }
    void realtime.start();
  }, [engine, realtime, tts]);

  const close = useCallback(() => {
    stopAll();
    onClose();
  }, [onClose, stopAll]);

  const isStandard = engine === "standard";
  const isLoading = isStandard
    ? tts.status === "loading"
    : realtime.status === "connecting" || realtime.status === "ready";
  const isPlaying = isStandard ? tts.isPlaying : realtime.isActive;
  const realtimeStatus = realtime.error
    ? realtime.error
    : realtime.firstAudioMs
      ? `Primeiro áudio em ${realtime.firstAudioMs}ms`
      : realtime.status === "idle"
        ? "Pronto para baixa latência"
        : realtime.status === "connecting"
          ? "Conectando sessão..."
          : realtime.status === "ready"
            ? "Sessão pronta..."
            : realtime.status === "speaking"
              ? "Recebendo áudio ao vivo"
              : realtime.status === "completed"
                ? "Leitura concluída"
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
        <div
          role="group"
          aria-label="Motor de áudio"
          className="flex min-w-0 items-center rounded-lg bg-background/55 p-0.5 text-nano"
        >
          <button
            type="button"
            aria-label="Escolher TTS padrão"
            aria-pressed={isStandard}
            onClick={() => selectEngine("standard")}
            className={cn(
              "h-6 rounded-md px-2 transition-colors",
              isStandard
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            TTS padrão
          </button>
          <button
            type="button"
            aria-label="Escolher Realtime 2.1"
            aria-pressed={!isStandard}
            onClick={() => selectEngine("realtime")}
            className={cn(
              "h-6 rounded-md px-2 transition-colors",
              !isStandard
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Realtime 2.1
          </button>
        </div>

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
                  : "Download completo disponível apenas em MP3"
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
              "min-w-0 flex-1 truncate text-nano",
              realtime.error && "text-rose-600 dark:text-rose-300"
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
