"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";
import type { SoundCaseGrokSettings, SoundCaseGrokVoice } from "@/hooks/useSoundCaseGrokSettings";
import styles from "./SoundCase.module.css";

export function SoundCaseGrokRealtimeSettings({ settings, onChange }: { settings: SoundCaseGrokSettings; onChange: (next: SoundCaseGrokSettings) => void }) {
  const [voices, setVoices] = useState<SoundCaseGrokVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (settings.engine !== "grok") return;
    const controller = new AbortController();
    void fetch(apiUrl("/api/soundcase/grok-realtime/voices"), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as { voices?: SoundCaseGrokVoice[]; message?: string } | null;
        if (!response.ok) throw new Error(body?.message ?? "Não foi possível listar as vozes Grok.");
        setVoices(Array.isArray(body?.voices) ? body.voices : []); setError(null);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível listar as vozes Grok."); });
    return () => controller.abort();
  }, [settings.engine, attempt]);
  return <div className={styles.realtimeSettings}>
    <label className={styles.realtimeField}><span>Leitura ao vivo</span>
      <select className={styles.realtimeSelect} aria-label="Leitura ao vivo" value={settings.engine} onChange={(event) => onChange({ ...settings, engine: event.target.value === "grok" ? "grok" : "openai" })}>
        <option value="openai">Realtime OpenAI</option><option value="grok">Grok Realtime experimental</option>
      </select>
    </label>
    {settings.engine === "grok" ? <>
      <p className={styles.realtimeHint}>A leitura Grok é experimental, usa somente texto e não cria arquivo.</p>
      <label className={styles.realtimeField}><span>Voz Grok</span><select className={styles.realtimeSelect} aria-label="Voz Grok" value={settings.voice} onChange={(event) => onChange({ ...settings, voice: event.target.value })}>
        <option value="eve">eve</option>{voices.filter((voice) => voice.id !== "eve").map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
      </select></label>
      <label className={styles.realtimeField}><span>Velocidade: {settings.speed.toFixed(1)}x</span><input className={styles.realtimeSpeed} aria-label="Velocidade da voz Grok" type="range" min="0.7" max="1.5" step="0.1" value={settings.speed} onChange={(event) => onChange({ ...settings, speed: Number(event.target.value) })} /></label>
      {error ? <p role="alert" className={styles.playerError}>{error} <button className={styles.secondaryAction} type="button" onClick={() => setAttempt((current) => current + 1)}>Tentar novamente</button></p> : null}
    </> : null}
  </div>;
}
