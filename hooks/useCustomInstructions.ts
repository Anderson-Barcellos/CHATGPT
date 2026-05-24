"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiUrl } from "@/lib/utils";
import { CustomInstructions, TtsPreferences } from "@/types";
import { useDebounce } from "@/lib/performance/debounce";
import { DEFAULT_TTS_PREFERENCES, normalizeTtsPreferences } from "@/lib/tts/speechText";

let instructionsBootstrapPromise: Promise<CustomInstructions> | null = null;
let instructionsBootstrapData: CustomInstructions | null = null;
let instructionsBootstrapSnapshot: string | null = null;
type SaveStatus = "idle" | "saving" | "saved" | "error";

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

export function useCustomInstructions() {
  const { customInstructions, setCustomInstructions } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isLoaded, setIsLoaded] = useState(false);
  const bootstrapRef = useRef(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);

  const instructions =
    customInstructions ??
    ({
      id: "default",
      contextAboutUser: "",
      responsePreferences: "",
      customSystemInstructions: "",
      ttsPreferences: DEFAULT_TTS_PREFERENCES,
    } satisfies CustomInstructions);
  const debouncedSnapshot = useDebounce(
    toSnapshot(instructions),
    700
  );

  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    if (instructionsBootstrapData) {
      lastSavedSnapshotRef.current =
        instructionsBootstrapSnapshot ?? toSnapshot(instructionsBootstrapData);
      setCustomInstructions(instructionsBootstrapData);
      setIsLoaded(true);
      return;
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
          const hydrated = {
            id: data.id || "default",
            contextAboutUser: data.contextAboutUser || "",
            responsePreferences: data.responsePreferences || "",
            customSystemInstructions: data.customSystemInstructions || "",
            ttsPreferences: normalizeTtsPreferences(data.ttsPreferences),
          };
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
        lastSavedSnapshotRef.current =
          instructionsBootstrapSnapshot ?? toSnapshot(hydrated);
        setCustomInstructions(hydrated);
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
    setCustomInstructions({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: value,
      responsePreferences: current?.responsePreferences || "",
      customSystemInstructions: current?.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences(current?.ttsPreferences),
    });
  }, [setCustomInstructions]);

  const updateResponsePreferences = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: current?.contextAboutUser || "",
      responsePreferences: value,
      customSystemInstructions: current?.customSystemInstructions || "",
      ttsPreferences: normalizeTtsPreferences(current?.ttsPreferences),
    });
  }, [setCustomInstructions]);

  const updateTtsPreferences = useCallback((updates: Partial<TtsPreferences>) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions({
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
  }, [setCustomInstructions]);

  const saveContextAboutUser = useCallback(async (nextInstructions?: CustomInstructions) => {
    const payload = nextInstructions ?? instructions;
    setIsSaving(true);
    setSaveStatus("saving");
    try {
      const res = await fetch(apiUrl("/api/persona"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = (await res.json()) as CustomInstructions;
      const hydrated = {
        id: data.id || "default",
        contextAboutUser: data.contextAboutUser || "",
        responsePreferences: data.responsePreferences || "",
        customSystemInstructions: data.customSystemInstructions || "",
        ttsPreferences: normalizeTtsPreferences(data.ttsPreferences),
      };
      lastSavedSnapshotRef.current = toSnapshot(hydrated);
      instructionsBootstrapData = hydrated;
      instructionsBootstrapSnapshot = lastSavedSnapshotRef.current;
      setCustomInstructions(hydrated);
      setSaveStatus("saved");
      return true;
    } catch (err) {
      console.error("[useCustomInstructions] Failed to save persona:", err);
      setSaveStatus("error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [instructions, setCustomInstructions]);

  useEffect(() => {
    if (!isLoaded || isSaving) return;
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
    instructions.customSystemInstructions,
    instructions.id,
    isLoaded,
    isSaving,
    saveContextAboutUser,
  ]);

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
    updateTtsPreferences,
    saveContextAboutUser,
    isSaving,
    saveStatus,
    isLoaded,
  };
}
