"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemorySuggestion } from "@/types";
import {
  listMemorySuggestions,
  updateMemorySuggestion,
} from "@/lib/storage/memoryRag";
import { listMemories } from "@/lib/storage/memories";
import { useSettingsStore } from "@/stores/settingsStore";

export function useMemorySuggestions() {
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const setMemories = useSettingsStore((state) => state.setMemories);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setSuggestions(await listMemorySuggestions());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [refresh]);

  const acceptSuggestion = useCallback(
    async (id: string, content?: string) => {
      setIsUpdating(id);
      try {
        await updateMemorySuggestion({ id, status: "accepted", content });
        setSuggestions((current) =>
          current.filter((suggestion) => suggestion.id !== id)
        );
        setMemories(await listMemories());
      } finally {
        setIsUpdating(null);
      }
    },
    [setMemories]
  );

  const rejectSuggestion = useCallback(async (id: string) => {
    setIsUpdating(id);
    try {
      await updateMemorySuggestion({ id, status: "rejected" });
      setSuggestions((current) =>
        current.filter((suggestion) => suggestion.id !== id)
      );
    } finally {
      setIsUpdating(null);
    }
  }, []);

  return {
    suggestions,
    isLoading,
    isUpdating,
    refresh,
    acceptSuggestion,
    rejectSuggestion,
  };
}
