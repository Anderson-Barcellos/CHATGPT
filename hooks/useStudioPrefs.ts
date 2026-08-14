"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_STUDIO_MODEL_ID, isStudioModelId } from "@/lib/studio/models";
import type {
  StudioAssistantMessage,
  StudioWorkspaceSnapshot,
} from "@/lib/studio/types";
import {
  applyStudioWorkspaceMutation,
  createInitialStudioWorkspace,
  limitStudioAssistantMessages,
  readStudioWorkspaceFromStorage,
  writeStudioWorkspaceToStorage,
} from "@/lib/studio/workspace";

function createMessageId() {
  return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Preferências e histórico do assistente do Studio (localStorage). O conteúdo
// dos arquivos vive no workspace do servidor; aqui fica só o que é do browser.
export function useStudioPrefs() {
  const [prefs, setPrefs] = useState<StudioWorkspaceSnapshot>(
    createInitialStudioWorkspace
  );
  const [hydrated, setHydrated] = useState(false);
  const prefsRef = useRef(prefs);
  const pendingPrefsRef = useRef<StudioWorkspaceSnapshot | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const result = readStudioWorkspaceFromStorage(window.localStorage);
      prefsRef.current = result.workspace;
      setPrefs(result.workspace);
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    pendingPrefsRef.current = prefs;
    const timeout = window.setTimeout(() => {
      const pending = pendingPrefsRef.current;
      if (!pending) return;
      writeStudioWorkspaceToStorage(window.localStorage, pending);
      if (pendingPrefsRef.current === pending) {
        pendingPrefsRef.current = null;
      }
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [hydrated, prefs]);

  useEffect(() => {
    if (!hydrated) return;

    const flushPendingPrefs = () => {
      const pending = pendingPrefsRef.current;
      if (!pending) return;
      writeStudioWorkspaceToStorage(window.localStorage, pending);
      if (pendingPrefsRef.current === pending) {
        pendingPrefsRef.current = null;
      }
    };

    window.addEventListener("pagehide", flushPendingPrefs);
    return () => {
      window.removeEventListener("pagehide", flushPendingPrefs);
      flushPendingPrefs();
    };
  }, [hydrated]);

  const mutatePrefs = useCallback(
    (mutator: (current: StudioWorkspaceSnapshot) => StudioWorkspaceSnapshot) => {
      const result = applyStudioWorkspaceMutation(prefsRef.current, mutator);
      if (!result.changed) return;
      prefsRef.current = result.workspace;
      pendingPrefsRef.current = result.workspace;
      setPrefs(result.workspace);
    },
    []
  );

  const addAssistantMessage = useCallback(
    (
      role: StudioAssistantMessage["role"],
      content: string,
      status: StudioAssistantMessage["status"] = "completed"
    ) => {
      const message: StudioAssistantMessage = {
        id: createMessageId(),
        role,
        content,
        createdAt: new Date().toISOString(),
        status,
      };
      mutatePrefs((current) => ({
        ...current,
        assistantMessages: limitStudioAssistantMessages([
          ...current.assistantMessages,
          message,
        ]),
      }));
      return message.id;
    },
    [mutatePrefs]
  );

  const updateAssistantMessage = useCallback(
    (id: string, patch: Partial<StudioAssistantMessage>) => {
      mutatePrefs((current) => ({
        ...current,
        assistantMessages: current.assistantMessages.map((message) =>
          message.id === id ? { ...message, ...patch } : message
        ),
      }));
    },
    [mutatePrefs]
  );

  const clearAssistantMessages = useCallback(() => {
    mutatePrefs((current) =>
      current.assistantMessages.length === 0
        ? current
        : { ...current, assistantMessages: [] }
    );
  }, [mutatePrefs]);

  const setSelectedModelId = useCallback(
    (modelId: string) => {
      mutatePrefs((current) => ({
        ...current,
        selectedModelId: isStudioModelId(modelId)
          ? modelId
          : DEFAULT_STUDIO_MODEL_ID,
      }));
    },
    [mutatePrefs]
  );

  const setAutocompleteEnabled = useCallback(
    (enabled: boolean) => {
      mutatePrefs((current) =>
        current.autocompleteEnabled === enabled
          ? current
          : { ...current, autocompleteEnabled: enabled }
      );
    },
    [mutatePrefs]
  );

  return {
    prefs,
    hydrated,
    addAssistantMessage,
    updateAssistantMessage,
    clearAssistantMessages,
    setSelectedModelId,
    setAutocompleteEnabled,
  };
}
