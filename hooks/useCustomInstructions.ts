"use client";

import { useEffect, useState, useCallback } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { apiUrl } from "@/lib/utils";

interface PersonaData {
  contextAboutUser: string;
}

export function useCustomInstructions() {
  const [contextAboutUser, setContextAboutUser] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/persona"))
      .then((res) => res.json())
      .then((data: PersonaData) => {
        setContextAboutUser(data.contextAboutUser || "");
        useSettingsStore.getState().setCustomInstructions({
          id: "default",
          contextAboutUser: data.contextAboutUser || "",
          responsePreferences: "",
        });
      })
      .catch((err) => {
        console.error("[useCustomInstructions] Failed to load persona:", err);
      });
  }, []);

  const updateContextAboutUser = useCallback(async (value: string) => {
    setContextAboutUser(value);
    useSettingsStore.getState().setCustomInstructions({
      id: "default",
      contextAboutUser: value,
      responsePreferences: "",
    });
  }, []);

  const saveContextAboutUser = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl("/api/persona"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextAboutUser }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return true;
    } catch (err) {
      console.error("[useCustomInstructions] Failed to save persona:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [contextAboutUser]);

  return {
    contextAboutUser,
    updateContextAboutUser,
    saveContextAboutUser,
    isSaving,
  };
}
