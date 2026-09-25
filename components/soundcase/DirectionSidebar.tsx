"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";

import { Gauge, Headphones, Mic2, SlidersHorizontal, Sparkles, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";
import { TTS_VOICES } from "@/lib/tts/speechText";
import styles from "./SoundCase.module.css";

export interface DirectionSidebarProps {
  settings: SoundCaseGenerationSettings;
  disabled?: boolean;
  busy?: boolean;
  /** O workspace concentra as ações junto ao texto; configurações só exibem controles. */
  showActions?: boolean;
  onChange: (settings: SoundCaseGenerationSettings) => void;
  onGenerate: (mode: "realtime" | "silent") => void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DirectionSidebar({ settings, disabled, busy, showActions = true, onChange, onGenerate }: DirectionSidebarProps) {
  const [grokVoices, setGrokVoices] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (settings.ttsProvider !== "grok") return;
    const controller = new AbortController();
    void fetch(apiUrl("/api/soundcase/grok-realtime/voices"), { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body: { voices?: Array<{ id: string; name: string }> } | null) => {
        if (!controller.signal.aborted && Array.isArray(body?.voices)) setGrokVoices(body.voices);
      }).catch(() => undefined);
    return () => controller.abort();
  }, [settings.ttsProvider]);
  const update = (patch: Partial<SoundCaseGenerationSettings>, override = false) => {
    onChange({ ...settings, ...patch, ...(override ? { automatic: false } : {}) });
  };
  const voice = settings.voiceOverride ?? "";
  const speed = settings.speedOverride ?? 1;

  return (
    <aside className={styles.direction} aria-label="Direção de leitura">
      <div className={styles.sideHeading}>Direção de leitura</div>
      <label className={styles.controlCard}>
        <span className={styles.controlIcon}><Sparkles /></span>
        <span className={styles.controlCopy}>
          <strong>Automático · Luna</strong>
          <small>Luna analisa o conteúdo</small>
        </span>
        <Switch
          aria-label="Direção automática com Luna"
          checked={settings.automatic}
          disabled={busy}
          onCheckedChange={(automatic) => update({ automatic, ...(automatic ? {
            voiceOverride: null, speedOverride: null, instructionsOverride: null,
          } : {}) })}
        />
      </label>

      <label className={styles.controlCard}>
        <span className={styles.controlIcon}><Volume2 /></span>
        <span className={styles.controlCopy}><strong>TTS do arquivo</strong><small>Escolha para a próxima narração</small></span>
        <select className={styles.compactSelect} aria-label="TTS do arquivo" disabled={busy} value={settings.ttsProvider ?? "openai"}
          onChange={(event) => update({ ttsProvider: event.target.value === "grok" ? "grok" : "openai", grokVoice: settings.grokVoice ?? "orion" })}>
          <option value="grok">Grok TTS</option><option value="openai">OpenAI TTS</option>
        </select>
      </label>

      {settings.ttsProvider === "grok" ? <label className={styles.controlCard}>
        <span className={styles.controlIcon}><Mic2 /></span>
        <span className={styles.controlCopy}><strong>Voz Grok do arquivo</strong><small>Independente da leitura ao vivo</small></span>
        <select className={styles.compactSelect} aria-label="Voz Grok do arquivo" disabled={busy} value={settings.grokVoice ?? "orion"}
          onChange={(event) => update({ grokVoice: event.target.value })}>
          <option value="orion">Orion</option>
          {settings.grokVoice && settings.grokVoice !== "orion" && !grokVoices.some((voice) => voice.id === settings.grokVoice)
            ? <option value={settings.grokVoice}>{settings.grokVoice}</option> : null}
          {grokVoices.filter((voice) => voice.id !== "orion").map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
        </select>
      </label> : null}

      {settings.ttsProvider !== "grok" ? <label className={styles.controlCard}>
        <span className={styles.controlIcon}><Mic2 /></span>
        <span className={styles.controlCopy}><strong>Voz</strong><small>{settings.automatic ? "Luna escolhe ao gerar" : "Escolha manual"}</small></span>
        <select
          className={styles.compactSelect}
          aria-label="Voz da narração"
          value={voice}
          disabled={busy}
          onChange={(event) => update({ voiceOverride: (event.target.value || null) as typeof settings.voiceOverride }, true)}
        >
          <option value="">{settings.automatic ? "Automática" : "Padrão"}</option>
          {TTS_VOICES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </select>
      </label> : null}

      <div className={styles.sliderCard}>
        <span className={styles.controlIcon}><Gauge /></span>
        <div className={styles.sliderBody}>
          <div><strong>Ritmo · {settings.automatic && settings.speedOverride === null ? "Luna escolhe" : speed === 1 ? "Natural" : `${speed.toFixed(2)}×`}</strong></div>
          <Slider aria-label="Velocidade da narração" disabled={busy} min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => update({ speedOverride: value }, true)} />
        </div>
      </div>

      <label className={styles.controlCard}>
        <span className={styles.controlIcon}><SlidersHorizontal /></span>
        <span className={styles.controlCopy}><strong>Formato</strong><small>Arquivo final para baixar</small></span>
        <select className={styles.compactSelect} aria-label="Formato do arquivo" disabled={busy} value={settings.format} onChange={(event) => update({ format: event.target.value as SoundCaseGenerationSettings["format"] })}>
          <option value="mp3">MP3</option><option value="flac">FLAC</option><option value="wav">WAV</option>
        </select>
      </label>

      {settings.ttsProvider !== "grok" ? <label className={styles.instructionsLabel}>
        <span>Direção personalizada</span>
        <textarea
          aria-label="Instruções de leitura"
          disabled={busy}
          value={settings.instructionsOverride ?? ""}
          placeholder="Ex.: leitura íntima, com pausas longas…"
          onChange={(event) => update({ instructionsOverride: event.target.value || null }, true)}
          maxLength={1200}
        />
      </label> : null}

      {showActions ? (
        <>
          <button className={styles.primaryAction} type="button" disabled={disabled || busy} onClick={() => onGenerate("realtime")}>
            <Volume2 /> {busy ? "Preparando…" : "Gerar e ouvir agora"}
          </button>
          <button className={styles.secondaryAction} type="button" disabled={disabled || busy} onClick={() => onGenerate("silent")}>
            <Headphones /> Gerar silenciosamente
          </button>
        </>
      ) : null}
    </aside>
  );
}
