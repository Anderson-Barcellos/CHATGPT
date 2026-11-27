"use client";

import {
  GEMINI_TTS_EXPRESSIVENESS,
  GEMINI_TTS_PACES,
  GEMINI_TTS_PROFILE,
  type GeminiTtsSettings,
} from "@/lib/tts/geminiTts";
import { cn } from "@/lib/utils";

interface Props {
  settings: GeminiTtsSettings;
  onChange: (next: GeminiTtsSettings) => void;
  fieldClassName?: string;
  selectClassName?: string;
}

const DEFAULT_FIELD = "flex flex-col gap-1 text-xs";
const DEFAULT_SELECT = "gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs";

export function GeminiTtsSettingsFields({ settings, onChange, fieldClassName, selectClassName }: Props) {
  const field = fieldClassName ?? DEFAULT_FIELD;
  const select = selectClassName ?? DEFAULT_SELECT;
  const labelClassName = cn(!fieldClassName && "text-muted-foreground");

  return <>
    <div className={field}>
      <span className={labelClassName}>Voz Gemini TTS</span>
      <div className={select}>Charon · fixa</div>
    </div>
    <div className={field}>
      <span className={labelClassName}>Perfil de leitura</span>
      <div className={select}>{GEMINI_TTS_PROFILE.label}</div>
    </div>
    <label className={field}>
      <span className={labelClassName}>Cadência da leitura</span>
      <select
        className={select}
        aria-label="Cadência Gemini TTS"
        value={settings.pace}
        onChange={(event) => onChange({ ...settings, pace: event.target.value as GeminiTtsSettings["pace"] })}
      >
        {Object.entries(GEMINI_TTS_PACES).map(([id, pace]) => (
          <option key={id} value={id}>{pace.label}</option>
        ))}
      </select>
    </label>
    <label className={field}>
      <span className={labelClassName}>Expressividade da leitura</span>
      <select
        className={select}
        aria-label="Expressividade Gemini TTS"
        value={settings.expressiveness}
        onChange={(event) => onChange({ ...settings, expressiveness: event.target.value as GeminiTtsSettings["expressiveness"] })}
      >
        {Object.entries(GEMINI_TTS_EXPRESSIVENESS).map(([id, entry]) => (
          <option key={id} value={id}>{entry.label}</option>
        ))}
      </select>
    </label>
  </>;
}
