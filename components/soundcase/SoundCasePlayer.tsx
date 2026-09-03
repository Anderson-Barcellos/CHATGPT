"use client";

import { Download, FileAudio, Pause, Play, Radio, Square } from "lucide-react";
import { useRef, useState } from "react";
import { describeAudioPlayError, primeBrowserAudio } from "@/lib/tts/browserAudio";
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
}

export function SoundCasePlayer({ version, audioUrl, realtime }: SoundCasePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const unlockedRef = useRef(false);
  const [playingFinal, setPlayingFinal] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const readyAudio = version.audio.status === "ready" ? version.audio : null;
  const finalReady = Boolean(readyAudio);

  const playFinal = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    primeBrowserAudio(audio, unlockedRef);
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
      <audio ref={audioRef} src={finalReady ? audioUrl : undefined} preload="metadata" playsInline onPause={() => setPlayingFinal(false)} onEnded={() => setPlayingFinal(false)} />
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
      {playError ? <p className={styles.playerError} role="alert">{playError}</p> : null}
    </section>
  );
}
