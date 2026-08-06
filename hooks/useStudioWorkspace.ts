"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STUDIO_MODEL_ID, isStudioModelId } from "@/lib/studio/models";
import type {
  StudioAssistantMessage,
  StudioFile,
  StudioWorkspaceSnapshot,
} from "@/lib/studio/types";
import {
  applyStudioWorkspaceMutation,
  createInitialStudioWorkspace,
  limitStudioAssistantMessages,
  readStudioWorkspaceFromStorage,
  writeStudioWorkspaceToStorage,
} from "@/lib/studio/workspace";

export type StudioSaveState = "loading" | "saving" | "saved" | "error";

function createMessageId() {
  return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useStudioWorkspace() {
  const [workspace, setWorkspace] = useState<StudioWorkspaceSnapshot>(
    createInitialStudioWorkspace
  );
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<StudioSaveState>("loading");
  const workspaceRef = useRef(workspace);
  const pendingWorkspaceRef = useRef<StudioWorkspaceSnapshot | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const result = readStudioWorkspaceFromStorage(window.localStorage);
      workspaceRef.current = result.workspace;
      setWorkspace(result.workspace);
      setHydrated(true);
      setSaveState(result.ok ? "saved" : "error");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    pendingWorkspaceRef.current = workspace;
    const timeout = window.setTimeout(() => {
      const pending = pendingWorkspaceRef.current;
      if (!pending) return;
      const saved = writeStudioWorkspaceToStorage(window.localStorage, pending);
      if (pendingWorkspaceRef.current === pending) {
        pendingWorkspaceRef.current = null;
      }
      setSaveState(saved ? "saved" : "error");
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [hydrated, workspace]);

  useEffect(() => {
    if (!hydrated) return;

    const flushPendingWorkspace = () => {
      const pending = pendingWorkspaceRef.current;
      if (!pending) return;
      writeStudioWorkspaceToStorage(window.localStorage, pending);
      if (pendingWorkspaceRef.current === pending) {
        pendingWorkspaceRef.current = null;
      }
    };

    window.addEventListener("pagehide", flushPendingWorkspace);
    return () => {
      window.removeEventListener("pagehide", flushPendingWorkspace);
      flushPendingWorkspace();
    };
  }, [hydrated]);

  const mutateWorkspace = useCallback(
    (mutator: (current: StudioWorkspaceSnapshot) => StudioWorkspaceSnapshot) => {
      const result = applyStudioWorkspaceMutation(
        workspaceRef.current,
        mutator
      );
      if (!result.changed) return;
      workspaceRef.current = result.workspace;
      pendingWorkspaceRef.current = result.workspace;
      setSaveState("saving");
      setWorkspace(result.workspace);
    },
    []
  );

  const activeFile = workspace.files[workspace.activeFilePath];
  const openFiles = useMemo(
    () =>
      workspace.openFilePaths
        .map((path) => workspace.files[path])
        .filter((file): file is StudioFile => Boolean(file)),
    [workspace.files, workspace.openFilePaths]
  );

  const openFile = useCallback(
    (path: string) => {
      mutateWorkspace((current) => {
        if (!current.files[path]) return current;
        return {
          ...current,
          activeFilePath: path,
          openFilePaths: current.openFilePaths.includes(path)
            ? current.openFilePaths
            : [...current.openFilePaths, path],
        };
      });
    },
    [mutateWorkspace]
  );

  const closeFile = useCallback(
    (path: string) => {
      mutateWorkspace((current) => {
        if (current.openFilePaths.length <= 1) return current;
        const closingIndex = current.openFilePaths.indexOf(path);
        const nextOpenPaths = current.openFilePaths.filter(
          (candidate) => candidate !== path
        );
        const nextActivePath =
          current.activeFilePath === path
            ? nextOpenPaths[Math.max(0, closingIndex - 1)] ?? nextOpenPaths[0]
            : current.activeFilePath;

        return {
          ...current,
          activeFilePath: nextActivePath,
          openFilePaths: nextOpenPaths,
        };
      });
    },
    [mutateWorkspace]
  );

  const updateActiveFile = useCallback(
    (content: string) => {
      mutateWorkspace((current) => {
        const file = current.files[current.activeFilePath];
        if (!file || file.content === content) return current;
        return {
          ...current,
          files: {
            ...current.files,
            [file.path]: { ...file, content },
          },
        };
      });
    },
    [mutateWorkspace]
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
      mutateWorkspace((current) => ({
        ...current,
        assistantMessages: limitStudioAssistantMessages([
          ...current.assistantMessages,
          message,
        ]),
      }));
      return message.id;
    },
    [mutateWorkspace]
  );

  const updateAssistantMessage = useCallback(
    (id: string, patch: Partial<StudioAssistantMessage>) => {
      mutateWorkspace((current) => ({
        ...current,
        assistantMessages: current.assistantMessages.map((message) =>
          message.id === id ? { ...message, ...patch } : message
        ),
      }));
    },
    [mutateWorkspace]
  );

  const clearAssistantMessages = useCallback(() => {
    mutateWorkspace((current) =>
      current.assistantMessages.length === 0
        ? current
        : { ...current, assistantMessages: [] }
    );
  }, [mutateWorkspace]);

  const setSelectedModelId = useCallback(
    (modelId: string) => {
      mutateWorkspace((current) => ({
        ...current,
        selectedModelId: isStudioModelId(modelId)
          ? modelId
          : DEFAULT_STUDIO_MODEL_ID,
      }));
    },
    [mutateWorkspace]
  );

  return {
    workspace,
    activeFile,
    openFiles,
    saveState,
    hydrated,
    openFile,
    closeFile,
    updateActiveFile,
    addAssistantMessage,
    updateAssistantMessage,
    clearAssistantMessages,
    setSelectedModelId,
  };
}
