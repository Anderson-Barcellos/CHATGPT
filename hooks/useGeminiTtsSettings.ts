"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  normalizeGeminiTtsSettings,
  type GeminiTtsSettings,
} from "@/lib/tts/geminiTts";

export const GEMINI_TTS_SETTINGS_KEY = "gaucho:gemini-tts:v1";
const LEGACY_OPENAI_LIVE_SETTINGS_KEY = "gaucho:openai-live:v1";
const CHANGE_EVENT = "gaucho:gemini-tts-settings";
let sessionFallback: string | null = null;

function read() {
  try {
    return sessionFallback
      ?? window.localStorage.getItem(GEMINI_TTS_SETTINGS_KEY)
      ?? window.localStorage.getItem(LEGACY_OPENAI_LIVE_SETTINGS_KEY);
  } catch {
    return sessionFallback;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === GEMINI_TTS_SETTINGS_KEY
      || event.key === LEGACY_OPENAI_LIVE_SETTINGS_KEY
      || event.key === null
    ) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function parse(raw: string | null): GeminiTtsSettings {
  try {
    return normalizeGeminiTtsSettings(JSON.parse(raw ?? "null"));
  } catch {
    return normalizeGeminiTtsSettings(null);
  }
}

export function readGeminiTtsSettings(): GeminiTtsSettings {
  return typeof window === "undefined" ? normalizeGeminiTtsSettings(null) : parse(read());
}

export function useGeminiTtsSettings() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => parse(raw), [raw]);
  const setSettings = (next: GeminiTtsSettings) => {
    const serialized = JSON.stringify(normalizeGeminiTtsSettings(next));
    try {
      window.localStorage.setItem(GEMINI_TTS_SETTINGS_KEY, serialized);
      sessionFallback = null;
    } catch {
      sessionFallback = serialized;
      toast.error("Os ajustes do Gemini TTS valerão apenas nesta sessão.");
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { settings, setSettings };
}
