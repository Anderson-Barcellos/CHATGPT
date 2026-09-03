"use client";

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
  onChange: (settings: SoundCaseGenerationSettings) => void;
  onGenerate: (mode: "realtime" | "silent") => void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function DirectionSidebar({ settings, disabled, busy, onChange, onGenerate }: DirectionSidebarProps) {
  const update = (patch: Partial<SoundCaseGenerationSettings>, override = false) => {
    onChange({ ...settings, ...patch, ...(override ? { automatic: false } : {}) });
  };
  const voice = settings.voiceOverride ?? "marin";
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
          onCheckedChange={(automatic) => update({ automatic })}
        />
      </label>

      <label className={styles.controlCard}>
        <span className={styles.controlIcon}><Mic2 /></span>
        <span className={styles.controlCopy}><strong>Voz · {titleCase(voice)}</strong><small>{settings.automatic ? "Recomendada pelo diretor" : "Escolha manual"}</small></span>
        <select
          className={styles.compactSelect}
          aria-label="Voz da narração"
          value={voice}
          onChange={(event) => update({ voiceOverride: event.target.value as typeof voice }, true)}
        >
          {TTS_VOICES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </select>
      </label>

      <div className={styles.sliderCard}>
        <span className={styles.controlIcon}><Gauge /></span>
        <div className={styles.sliderBody}>
          <div><strong>Ritmo · {speed === 1 ? "Natural" : `${speed.toFixed(2)}×`}</strong></div>
          <Slider aria-label="Velocidade da narração" min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => update({ speedOverride: value }, true)} />
        </div>
      </div>

      <label className={styles.controlCard}>
        <span className={styles.controlIcon}><SlidersHorizontal /></span>
        <span className={styles.controlCopy}><strong>Saída · {settings.format.toUpperCase()}</strong><small>Arquivo final para baixar</small></span>
        <select className={styles.compactSelect} aria-label="Formato do arquivo" value={settings.format} onChange={(event) => update({ format: event.target.value as SoundCaseGenerationSettings["format"] }, true)}>
          <option value="mp3">MP3</option><option value="flac">FLAC</option><option value="wav">WAV</option>
        </select>
      </label>

      <label className={styles.instructionsLabel}>
        <span>Direção personalizada</span>
        <textarea
          aria-label="Instruções de leitura"
          value={settings.instructionsOverride ?? ""}
          placeholder="Ex.: leitura íntima, com pausas longas…"
          onChange={(event) => update({ instructionsOverride: event.target.value || null }, true)}
          maxLength={1200}
        />
      </label>

      <button className={styles.primaryAction} type="button" disabled={disabled || busy} onClick={() => onGenerate("realtime")}>
        <Volume2 /> {busy ? "Preparando…" : "Gerar e ouvir agora"}
      </button>
      <button className={styles.secondaryAction} type="button" disabled={disabled || busy} onClick={() => onGenerate("silent")}>
        <Headphones /> Gerar silenciosamente
      </button>
    </aside>
  );
}
