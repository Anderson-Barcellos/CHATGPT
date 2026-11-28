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
import { useGeminiTtsSpeech } from "@/hooks/useGeminiTtsSpeech";
import { cn } from "@/lib/utils";

export type AudioEngine = "standard" | "gemini-tts";

interface MiniAudioPlayerProps {
  content: string;
  messageId: string;
  onClose: () => void;
  allowGeminiTts?: boolean;
  className?: string;
}

function formatClock(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
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
  allowGeminiTts = true,
  className,
}: MiniAudioPlayerProps) {
  const [engine, setEngine] = useState<AudioEngine>("standard");
  const tts = useAssistantTts(content, messageId);
  const gemini = useGeminiTtsSpeech();

  const stopAll = useCallback(() => {
    tts.stop();
    gemini.stop();
  }, [gemini, tts]);

  const selectEngine = useCallback(
    (nextEngine: AudioEngine) => {
      if (nextEngine === engine) return;
      stopAll();
      setEngine(nextEngine);
    },
    [engine, stopAll]
  );

  const toggleSelectedEngine = useCallback(() => {
    if (engine === "standard" || !allowGeminiTts) {
      gemini.stop();
      tts.togglePlay();
      return;
    }

    tts.stop();
    if (gemini.status === "connecting") gemini.stop();
    else if (gemini.isActive || gemini.canResume) gemini.toggle();
    else void gemini.start({ text: content });
  }, [allowGeminiTts, content, engine, gemini, tts]);

  const close = useCallback(() => {
    stopAll();
    onClose();
  }, [onClose, stopAll]);

  const isStandard = engine === "standard";
  const isLoading = isStandard
    ? tts.status === "loading"
    : gemini.status === "connecting";
  const isPlaying = isStandard ? tts.isPlaying : gemini.status === "speaking";
  const playLabel = !isStandard && isLoading ? "Cancelar geração" : isPlaying ? "Pausar" : "Tocar";
  const geminiPart = gemini.totalClips > 1 ? ` · parte ${gemini.clipIndex + 1}/${gemini.totalClips}` : "";
  // A geração segue com a escuta pausada ou parada; enquanto faltar parte, o status diz quantas já chegaram.
  const geminiGenerating = gemini.status !== "connecting" && gemini.generatedClips > 0
    && gemini.generatedClips < gemini.totalClips && !gemini.generationError
    ? ` · gerando ${gemini.generatedClips}/${gemini.totalClips}` : "";
  const geminiFailure = gemini.error ?? (gemini.generationError ? `Geração interrompida · ${gemini.generationError}` : null);
  const geminiStatus = geminiFailure ?? `${{
    idle: "Pronto · Fronteira Técnica",
    connecting: `Gerando áudio…${geminiPart}`,
    ready: "Áudio pronto · toque para ouvir",
    speaking: `Charon está lendo${geminiPart}`,
    paused: `Leitura pausada${geminiPart}`,
    completed: "Leitura concluída",
    error: "Falha na leitura",
  }[gemini.status]}${geminiGenerating}`;
  const geminiShare = (seconds: number) => (gemini.duration > 0 ? Math.min((seconds / gemini.duration) * 100, 100) : 0);
  const geminiHasAudio = gemini.bufferedTime > 0;

  return (
    <div
      className={cn(
        "mt-1.5 w-full max-w-[340px] rounded-xl border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2 py-1.5 text-muted-foreground shadow-sm",
        className
      )}
      data-audio-engine={engine}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-[color:var(--gc-border-soft)] pb-1.5">
        {allowGeminiTts ? (
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
              aria-label="Escolher Gemini TTS com voz Charon"
              aria-pressed={engine === "gemini-tts"}
              onClick={() => selectEngine("gemini-tts")}
              className={cn(
                "h-6 whitespace-nowrap rounded-md px-1.5 transition-colors",
                engine === "gemini-tts"
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Gemini TTS · Charon
            </button>
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
          disabled={isStandard && ((isLoading && !isPlaying) || !tts.canPlay)}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/80 text-foreground hover:bg-background disabled:opacity-50"
          title={playLabel}
          aria-label={playLabel}
        >
          {isLoading ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-3.5" />
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
          <>
            <PlayerButton title="Voltar 15s" onClick={() => gemini.seekBy(-15)} disabled={!geminiHasAudio}>
              <RotateCcw className="size-3.5" />
            </PlayerButton>
            <PlayerButton title="Avançar 15s" onClick={() => gemini.seekBy(15)} disabled={!geminiHasAudio}>
              <RotateCw className="size-3.5" />
            </PlayerButton>

            <div className="min-w-0 flex-1">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-background/80">
                <div
                  data-slot="gemini-buffered"
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/25 transition-[width]"
                  style={{ width: `${geminiShare(gemini.bufferedTime)}%` }}
                />
                <div
                  data-slot="gemini-progress"
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
                  style={{ width: `${geminiShare(gemini.currentTime)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-nano leading-none">
                <span>{formatClock(gemini.currentTime)}</span>
                <span>{gemini.durationEstimated && gemini.duration > 0 ? "~" : ""}{formatClock(gemini.duration)}</span>
              </div>
            </div>

            <PlayerButton title="Parar" onClick={gemini.stopPlayback} disabled={gemini.status === "idle" || gemini.status === "error"}>
              <Square className="size-3.5" />
            </PlayerButton>
            {gemini.audioUrl ? (
              <a className="flex size-7 shrink-0 items-center justify-center rounded-lg hover:bg-background/70"
                href={gemini.audioUrl} download="leitura-charon.wav" title="Baixar áudio completo" aria-label="Baixar áudio Gemini WAV">
                <Download className="size-3.5" />
              </a>
            ) : (
              <PlayerButton title="Salvar WAV após a geração completa" onClick={() => undefined} disabled>
                <Download className="size-3.5" />
              </PlayerButton>
            )}
          </>
        )}
      </div>

      {!isStandard && (
        <p className={cn("mt-1.5 text-micro md:text-nano", geminiFailure && "text-rose-600 dark:text-rose-300")} aria-live="polite">
          {geminiStatus}
        </p>
      )}
    </div>
  );
}
