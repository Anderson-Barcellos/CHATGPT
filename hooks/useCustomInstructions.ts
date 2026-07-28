"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiUrl } from "@/lib/utils";
import { CustomInstructions, TtsPreferences } from "@/types";
import { useDebounce } from "@/lib/performance/debounce";
import { hydratePersona } from "@/lib/persona/persona";
import { normalizeTtsPreferences } from "@/lib/tts/speechText";

let instructionsBootstrapPromise: Promise<CustomInstructions> | null = null;
let instructionsBootstrapData: CustomInstructions | null = null;
let instructionsBootstrapSnapshot: string | null = null;
type SaveStatus = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_DELAY_MS = 500;
const TTS_QUICK_SAVE_DELAY_MS = 120;

function toSnapshot(
  instructions: Pick<
    CustomInstructions,
    | "contextAboutUser"
    | "responsePreferences"
    | "customSystemInstructions"
    | "ttsPreferences"
  >
) {
  return JSON.stringify({
    contextAboutUser: instructions.contextAboutUser,
    responsePreferences: instructions.responsePreferences,
    customSystemInstructions: instructions.customSystemInstructions || "",
    ttsPreferences: normalizeTtsPreferences(instructions.ttsPreferences),
  });
}

async function persistPersona(
  instructions: CustomInstructions,
  options: { keepalive?: boolean } = {}
): Promise<CustomInstructions> {
  const res = await fetch(apiUrl("/api/persona"), {
    method: options.keepalive ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(instructions),
    keepalive: options.keepalive,
  });
  if (!res.ok) throw new Error("Failed to save");
  return hydratePersona(await res.json());
}

function persistPersonaOnUnload(instructions: CustomInstructions) {
  const body = JSON.stringify(instructions);
  const url = apiUrl("/api/persona");

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function useCustomInstructions() {
  const { customInstructions, setCustomInstructions } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isLoaded, setIsLoaded] = useState(false);
  const bootstrapRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const instructionsRef = useRef<CustomInstructions | null>(null);
  const quickSaveTimerRef = useRef<number | null>(null);

  const instructions = hydratePersona(customInstructions);
  const debouncedSnapshot = useDebounce(
    toSnapshot(instructions),
    AUTOSAVE_DELAY_MS
  );

  useEffect(() => {
    instructionsRef.current = instructions;
  }, [instructions]);

  const saveContextAboutUser = useCallback(async (nextInstructions?: CustomInstructions) => {
    const payload = hydratePersona(nextInstructions ?? instructionsRef.current);
    const snapshot = toSnapshot(payload);
    if (snapshot === lastSavedSnapshotRef.current) return true;

    setIsSaving(true);
    setSaveStatus("saving");
    try {
      const hydrated = await persistPersona(payload);
      const savedSnapshot = toSnapshot(hydrated);
      lastSavedSnapshotRef.current = savedSnapshot;
      instructionsBootstrapData = hydrated;
      instructionsBootstrapSnapshot = savedSnapshot;
      const current = useSettingsStore.getState().getCustomInstructions();
      const currentSnapshot = current ? toSnapshot(hydratePersona(current)) : snapshot;
      if (currentSnapshot === snapshot || currentSnapshot === savedSnapshot) {
        setCustomInstructions(hydrated);
      }
      setSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("[useCustomInstructions] Failed to save persona:", err);
      setSaveStatus("error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [setCustomInstructions]);

  const scheduleQuickSave = useCallback((nextInstructions: CustomInstructions) => {
    if (quickSaveTimerRef.current) {
      window.clearTimeout(quickSaveTimerRef.current);
    }

    quickSaveTimerRef.current = window.setTimeout(() => {
      quickSaveTimerRef.current = null;
      void saveContextAboutUser(nextInstructions);
    }, TTS_QUICK_SAVE_DELAY_MS);
  }, [saveContextAboutUser]);

  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    if (instructionsBootstrapData) {
      const bootstrapTimer = window.setTimeout(() => {
        const current = useSettingsStore.getState().getCustomInstructions();
        lastSavedSnapshotRef.current =
          instructionsBootstrapSnapshot ?? toSnapshot(instructionsBootstrapData!);
        if (!current || toSnapshot(current) === lastSavedSnapshotRef.current) {
          setCustomInstructions(instructionsBootstrapData!);
        }
        setIsLoaded(true);
      }, 0);
      return () => window.clearTimeout(bootstrapTimer);
    }

    if (!instructionsBootstrapPromise) {
      instructionsBootstrapPromise = fetch(apiUrl("/api/persona"))
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          return res.json() as Promise<CustomInstructions>;
        })
        .then((data) => {
          const hydrated = hydratePersona(data);
          instructionsBootstrapData = hydrated;
          instructionsBootstrapSnapshot = toSnapshot(hydrated);
          return hydrated;
        })
        .finally(() => {
          instructionsBootstrapPromise = null;
        });
    }

    instructionsBootstrapPromise
      .then((hydrated) => {
        const current = useSettingsStore.getState().getCustomInstructions();
        lastSavedSnapshotRef.current =
          instructionsBootstrapSnapshot ?? toSnapshot(hydrated);
        if (!current || toSnapshot(current) === lastSavedSnapshotRef.current) {
          setCustomInstructions(hydrated);
        }
      })
      .catch((err) => {
        console.error("[useCustomInstructions] Failed to load persona:", err);
        setSaveStatus("error");
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, [setCustomInstructions]);

  const updateContextAboutUser = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions(hydratePersona({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: value,
      responsePreferences: current?.responsePreferences || "",
      customSystemInstructions: current?.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences(current?.ttsPreferences),
    }));
  }, [setCustomInstructions]);

  const updateResponsePreferences = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions(hydratePersona({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: current?.contextAboutUser || "",
      responsePreferences: value,
      customSystemInstructions: current?.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences(current?.ttsPreferences),
    }));
  }, [setCustomInstructions]);

  const updateCustomSystemInstructions = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions(hydratePersona({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: current?.contextAboutUser || "",
      responsePreferences: current?.responsePreferences || "",
      customSystemInstructions: value,
      ttsPreferences: normalizeTtsPreferences(current?.ttsPreferences),
    }));
  }, [setCustomInstructions]);

  const updateTtsPreferences = useCallback((updates: Partial<TtsPreferences>) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    const nextInstructions = hydratePersona({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: current?.contextAboutUser || "",
      responsePreferences: current?.responsePreferences || "",
      customSystemInstructions: current?.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences({
        ...normalizeTtsPreferences(current?.ttsPreferences),
        ...updates,
      }),
    });
    setCustomInstructions(nextInstructions);

    const updateKeys = Object.keys(updates);
    const isInstructionsOnly =
      updateKeys.length === 1 && updateKeys[0] === "instructions";
    if (!isInstructionsOnly) {
      scheduleQuickSave(nextInstructions);
    }
  }, [scheduleQuickSave, setCustomInstructions]);

  useEffect(() => {
    if (!isLoaded || isSaving) return;
    if (debouncedSnapshot !== toSnapshot(instructions)) return;
    if (debouncedSnapshot === lastSavedSnapshotRef.current) return;

    const parsed = JSON.parse(debouncedSnapshot) as Pick<
      CustomInstructions,
      | "contextAboutUser"
      | "responsePreferences"
      | "customSystemInstructions"
      | "ttsPreferences"
    >;

    void saveContextAboutUser({
      id: instructions.id,
      contextAboutUser: parsed.contextAboutUser,
      responsePreferences: parsed.responsePreferences,
      customSystemInstructions: parsed.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences(parsed.ttsPreferences),
    });
  }, [
    debouncedSnapshot,
    instructions,
    isLoaded,
    isSaving,
    saveContextAboutUser,
  ]);

  useEffect(() => {
    const flushPending = () => {
      const current = instructionsRef.current;
      if (!current) return;

      const snapshot = toSnapshot(current);
      if (snapshot === lastSavedSnapshotRef.current) return;

      if (quickSaveTimerRef.current) {
        window.clearTimeout(quickSaveTimerRef.current);
        quickSaveTimerRef.current = null;
      }

      persistPersonaOnUnload(current);
      lastSavedSnapshotRef.current = snapshot;
      instructionsBootstrapData = current;
      instructionsBootstrapSnapshot = snapshot;
    };

    window.addEventListener("pagehide", flushPending);
    window.addEventListener("beforeunload", flushPending);

    return () => {
      window.removeEventListener("pagehide", flushPending);
      window.removeEventListener("beforeunload", flushPending);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (quickSaveTimerRef.current) {
        window.clearTimeout(quickSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timeout = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  return {
    contextAboutUser: instructions.contextAboutUser,
    responsePreferences: instructions.responsePreferences,
    customSystemInstructions: instructions.customSystemInstructions || "",
    ttsPreferences: normalizeTtsPreferences(instructions.ttsPreferences),
    updateContextAboutUser,
    updateResponsePreferences,
    updateCustomSystemInstructions,
    updateTtsPreferences,
    saveContextAboutUser,
    isSaving,
    saveStatus,
    isLoaded,
  };
}
