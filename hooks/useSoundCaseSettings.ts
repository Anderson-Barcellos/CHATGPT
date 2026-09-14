"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { isTtsVoice } from "@/lib/tts/speechText";
import type { SoundCaseGenerationSettings } from "@/lib/soundcase/types";

export const SOUNDCASE_SETTINGS_KEY = "gaucho-soundcase:settings:v1";
const CHANGE_EVENT = "gaucho:soundcase-settings";
export const DEFAULT_SOUNDCASE_SETTINGS: SoundCaseGenerationSettings = {
  automatic: true, playbackMode: "realtime", format: "mp3",
  voiceOverride: null, speedOverride: null, instructionsOverride: null,
};
let sessionFallback: string | null = null;

function readSettings() {
  if (sessionFallback !== null) return sessionFallback;
  try { return window.localStorage.getItem(SOUNDCASE_SETTINGS_KEY); }
  catch { return sessionFallback; }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SOUNDCASE_SETTINGS_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function normalizeSettings(raw: string | null): SoundCaseGenerationSettings {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_SOUNDCASE_SETTINGS;
    return {
      automatic: typeof value.automatic === "boolean" ? value.automatic : true,
      playbackMode: value.playbackMode === "silent" ? "silent" : "realtime",
      format: value.format === "flac" || value.format === "wav" ? value.format : "mp3",
      voiceOverride: isTtsVoice(value.voiceOverride) ? value.voiceOverride : null,
      speedOverride: typeof value.speedOverride === "number" && Number.isFinite(value.speedOverride)
        ? Math.min(1.5, Math.max(0.75, value.speedOverride)) : null,
      instructionsOverride: typeof value.instructionsOverride === "string"
        ? value.instructionsOverride.slice(0, 1200) || null : null,
    };
  } catch { return DEFAULT_SOUNDCASE_SETTINGS; }
}

export function useSoundCaseSettings() {
  const raw = useSyncExternalStore(subscribe, readSettings, () => null);
  const settings = useMemo(() => normalizeSettings(raw), [raw]);
  const setSettings = (next: SoundCaseGenerationSettings) => {
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(SOUNDCASE_SETTINGS_KEY, serialized);
      sessionFallback = null;
    } catch {
      sessionFallback = serialized;
      toast.error("O navegador não permitiu salvar as preferências. Elas valem apenas nesta sessão.");
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { settings, setSettings };
}
