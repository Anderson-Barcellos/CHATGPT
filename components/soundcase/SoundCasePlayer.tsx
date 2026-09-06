"use client";

import { Download, FileAudio, Pause, Play, Radio, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeAudioPlayError } from "@/lib/tts/browserAudio";
import type { SoundCasePublicVersion } from "@/lib/soundcase/types";
import styles from "./SoundCase.module.css";

export async function switchToFinalAudio(input: {
  stopRealtime: () => void;
  playFinal: () => Promise<void>;
}) {
  input.stopRealtime();
  await input.playFinal();
}

export interface SoundCasePlayerProps {
  version: SoundCasePublicVersion;
  audioUrl: string;
  realtime: {
    status: string;
    firstAudioMs: number | null;
    isActive: boolean;
    stop: () => void;
  };
  /** Avisa o acervo quando o arquivo final começa ou para de tocar. */
  onPlaybackChange?: (playing: boolean) => void;
}

export function SoundCasePlayer({ version, audioUrl, realtime, onPlaybackChange }: SoundCasePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingFinal, setPlayingFinalState] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const readyAudio = version.audio.status === "ready" ? version.audio : null;
  const finalReady = Boolean(readyAudio);
  const duration = readyAudio?.durationSeconds ?? 0;
  const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); };
  }, []);

  const setPlayingFinal = (playing: boolean) => {
    setPlayingFinalState(playing);
    onPlaybackChange?.(playing);
  };

  const playFinal = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setPlayingFinal(true);
      setPlayError(null);
    } catch (error) {
      setPlayError(describeAudioPlayError(error, "Não consegui iniciar o arquivo final."));
    }
  };

  return (
    <section className={styles.player} aria-label="Player do SoundCase">
      <audio ref={audioRef} src={finalReady ? audioUrl : undefined} preload="metadata" playsInline onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPause={() => setPlayingFinal(false)} onEnded={() => setPlayingFinal(false)} />
      <button
        type="button"
        className={styles.playButton}
        aria-label={realtime.isActive ? "Parar leitura Realtime" : playingFinal ? "Pausar arquivo final" : "Reproduzir arquivo final"}
        disabled={!realtime.isActive && !finalReady}
        onClick={() => {
          if (realtime.isActive) realtime.stop();
          else if (playingFinal) audioRef.current?.pause();
          else void playFinal();
        }}
      >
        {realtime.isActive ? <Square /> : playingFinal ? <Pause /> : <Play />}
      </button>
      <div className={styles.playerNow}>
        <strong>{realtime.isActive ? <><Radio /> Realtime</> : <><FileAudio /> Arquivo final</>}</strong>
        <span>{realtime.isActive ? (realtime.status === "connecting" ? "Conectando…" : "Leitura em andamento") : readyAudio ? `${readyAudio.format.toUpperCase()} · ${Math.ceil(readyAudio.durationSeconds / 60)} min` : "Em preparação"}</span>
      </div>
      {finalReady && realtime.isActive ? (
        <button className={styles.switchFinal} type="button" onClick={() => void switchToFinalAudio({ stopRealtime: realtime.stop, playFinal })}>
          Arquivo final pronto <span>Ouvir agora</span>
        </button>
      ) : null}
      {finalReady ? <a className={styles.downloadButton} href={audioUrl} download aria-label="Baixar arquivo final"><Download /></a> : null}
      {finalReady ? (
        <div className={styles.playerTimeline}>
          <input type="range" aria-label="Posição do áudio" min={0} max={duration} step={0.1} value={Math.min(currentTime, duration)} onChange={(event) => {
            const seconds = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = seconds;
            setCurrentTime(seconds);
          }} />
          <span>{timeLabel(currentTime)} / {timeLabel(duration)}</span>
        </div>
      ) : null}
      {playError ? <p className={styles.playerError} role="alert">{playError}</p> : null}
    </section>
  );
}
