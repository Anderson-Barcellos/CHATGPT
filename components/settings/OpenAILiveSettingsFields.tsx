"use client";

import {
  OPENAI_LIVE_PACES,
  OPENAI_LIVE_VOICES,
  type OpenAILivePace,
  type OpenAILiveSettings,
  type OpenAILiveVoice,
} from "@/lib/tts/openaiLiveSpeech";
import { cn } from "@/lib/utils";

interface Props {
  settings: OpenAILiveSettings;
  onChange: (next: OpenAILiveSettings) => void;
  /** Classes do host: SoundCase usa o CSS module dele, as configurações usam os tokens do painel. */
  fieldClassName?: string;
  selectClassName?: string;
}

const DEFAULT_FIELD = "flex flex-col gap-1 text-xs";
const DEFAULT_SELECT = "gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs";

/** Voz e ritmo do OpenAI Live 1.1; trocar não inicia leitura, vale na próxima vez que tocar. */
export function OpenAILiveSettingsFields({ settings, onChange, fieldClassName, selectClassName }: Props) {
  const field = fieldClassName ?? DEFAULT_FIELD;
  const select = selectClassName ?? DEFAULT_SELECT;
  return <>
    <label className={field}>
      <span className={cn(!fieldClassName && "text-muted-foreground")}>Voz OpenAI Live</span>
      <select className={select} aria-label="Voz OpenAI Live" value={settings.voice}
        onChange={(event) => onChange({ ...settings, voice: event.target.value as OpenAILiveVoice })}>
        {OPENAI_LIVE_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
      </select>
    </label>
    <label className={field}>
      <span className={cn(!fieldClassName && "text-muted-foreground")}>Ritmo da leitura</span>
      <select className={select} aria-label="Ritmo OpenAI Live" value={settings.pace}
        onChange={(event) => onChange({ ...settings, pace: event.target.value as OpenAILivePace })}>
        {OPENAI_LIVE_PACES.map((pace) => <option key={pace.id} value={pace.id}>{pace.label}</option>)}
      </select>
    </label>
  </>;
}
