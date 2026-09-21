"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";

export type SoundCaseRealtimeEngine = "openai" | "grok";
export interface SoundCaseGrokSettings { engine: SoundCaseRealtimeEngine; voice: string; speed: number; }
export interface SoundCaseGrokVoice { id: string; name: string; }

export const SOUNDCASE_GROK_SETTINGS_KEY = "gaucho-soundcase:grok-realtime:v1";
const CHANGE_EVENT = "gaucho:soundcase-grok-realtime-settings";
export const DEFAULT_SOUNDCASE_GROK_SETTINGS: SoundCaseGrokSettings = { engine: "openai", voice: "eve", speed: 1 };
let sessionFallback: string | null = null;

function read() { try { return sessionFallback ?? window.localStorage.getItem(SOUNDCASE_GROK_SETTINGS_KEY); } catch { return sessionFallback; } }
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === SOUNDCASE_GROK_SETTINGS_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage); window.addEventListener(CHANGE_EVENT, onChange);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGE_EVENT, onChange); };
}

export function normalizeSoundCaseGrokSettings(raw: string | null): SoundCaseGrokSettings {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_SOUNDCASE_GROK_SETTINGS;
    return {
      engine: value.engine === "grok" ? "grok" : "openai",
      voice: typeof value.voice === "string" && value.voice.trim() ? value.voice.slice(0, 120) : "eve",
      speed: typeof value.speed === "number" && Number.isFinite(value.speed) ? Math.min(1.5, Math.max(0.7, value.speed)) : 1,
    };
  } catch { return DEFAULT_SOUNDCASE_GROK_SETTINGS; }
}

export function useSoundCaseGrokSettings() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => normalizeSoundCaseGrokSettings(raw), [raw]);
  const setSettings = (next: SoundCaseGrokSettings) => {
    const serialized = JSON.stringify(normalizeSoundCaseGrokSettings(JSON.stringify(next)));
    try { window.localStorage.setItem(SOUNDCASE_GROK_SETTINGS_KEY, serialized); sessionFallback = null; }
    catch { sessionFallback = serialized; toast.error("O navegador não permitiu salvar a voz Grok. Ela valerá apenas nesta sessão."); }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { settings, setSettings };
}
