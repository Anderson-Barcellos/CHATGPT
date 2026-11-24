"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { normalizeOpenAILiveSettings, type OpenAILiveSettings } from "@/lib/tts/openaiLiveSpeech";

// Uma só preferência para mensagens, Pulse e SoundCase: a voz escolhida vale em todo lugar.
export const OPENAI_LIVE_SETTINGS_KEY = "gaucho:openai-live:v1";
const CHANGE_EVENT = "gaucho:openai-live-settings";
let sessionFallback: string | null = null;

function read() { try { return sessionFallback ?? window.localStorage.getItem(OPENAI_LIVE_SETTINGS_KEY); } catch { return sessionFallback; } }
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === OPENAI_LIVE_SETTINGS_KEY || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage); window.addEventListener(CHANGE_EVENT, onChange);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGE_EVENT, onChange); };
}
function parse(raw: string | null) { try { return normalizeOpenAILiveSettings(JSON.parse(raw ?? "null")); } catch { return normalizeOpenAILiveSettings(null); } }

export function readOpenAILiveSettings(): OpenAILiveSettings {
  return typeof window === "undefined" ? normalizeOpenAILiveSettings(null) : parse(read());
}

export function useOpenAILiveSettings() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => parse(raw), [raw]);
  const setSettings = (next: OpenAILiveSettings) => {
    const serialized = JSON.stringify(normalizeOpenAILiveSettings(next));
    try { window.localStorage.setItem(OPENAI_LIVE_SETTINGS_KEY, serialized); sessionFallback = null; }
    catch { sessionFallback = serialized; toast.error("O navegador não permitiu salvar a voz do OpenAI Live. Ela valerá apenas nesta sessão."); }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { settings, setSettings };
}
