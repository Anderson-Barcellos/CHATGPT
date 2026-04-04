"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiUrl } from "@/lib/utils";
import { CustomInstructions } from "@/types";

let instructionsBootstrapPromise: Promise<void> | null = null;

export function useCustomInstructions() {
  const { customInstructions, setCustomInstructions } = useSettingsStore();
  const [isSaving, setIsSaving] = useState(false);
  const bootstrapRef = useRef(false);

  const instructions =
    customInstructions ??
    ({
      id: "default",
      contextAboutUser: "",
      responsePreferences: "",
    } satisfies CustomInstructions);

  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    if (!instructionsBootstrapPromise) {
      instructionsBootstrapPromise = fetch(apiUrl("/api/persona"))
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          return res.json() as Promise<CustomInstructions>;
        })
        .then((data) => {
          setCustomInstructions({
            id: data.id || "default",
            contextAboutUser: data.contextAboutUser || "",
            responsePreferences: data.responsePreferences || "",
          });
        })
        .catch((err) => {
          console.error("[useCustomInstructions] Failed to load persona:", err);
        })
        .finally(() => {
          instructionsBootstrapPromise = null;
        });
    }
  }, [setCustomInstructions]);

  const updateContextAboutUser = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: value,
      responsePreferences: current?.responsePreferences || "",
    });
  }, [setCustomInstructions]);

  const updateResponsePreferences = useCallback((value: string) => {
    const current = useSettingsStore.getState().getCustomInstructions();
    setCustomInstructions({
      ...(current ?? {}),
      id: current?.id || "default",
      contextAboutUser: current?.contextAboutUser || "",
      responsePreferences: value,
    });
  }, [setCustomInstructions]);

  const saveContextAboutUser = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl("/api/persona"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instructions),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = (await res.json()) as CustomInstructions;
      setCustomInstructions(data);
      return true;
    } catch (err) {
      console.error("[useCustomInstructions] Failed to save persona:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [instructions, setCustomInstructions]);

  return {
    contextAboutUser: instructions.contextAboutUser,
    responsePreferences: instructions.responsePreferences,
    updateContextAboutUser,
    updateResponsePreferences,
    saveContextAboutUser,
    isSaving,
  };
}
