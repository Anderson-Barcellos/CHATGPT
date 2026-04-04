"use client";

import { addMemory, deleteMemory, listMemories, updateMemory } from "@/lib/storage/memories";
import { Memory, MemoryCategory } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

let memoriesBootstrapPromise: Promise<void> | null = null;

export function useMemories() {
  const { memories, setMemories } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;

    if (!memoriesBootstrapPromise) {
      memoriesBootstrapPromise = listMemories()
        .then((loadedMemories) => {
          setMemories(loadedMemories);
        })
        .catch((err) => {
          console.error("[useMemories] Erro ao listar memórias:", err);
          setError("Erro ao carregar memórias");
        })
        .finally(() => {
          memoriesBootstrapPromise = null;
        });
    }
  }, [setMemories]);

  const add = useCallback(async (input: {
    content: string;
    category: MemoryCategory;
    isActive: boolean;
    priority: number;
  }) => {
    try {
      const memory = await addMemory(input);
      setMemories([memory, ...useSettingsStore.getState().memories]);
      return memory.id;
    } catch (err) {
      console.error("[useMemories] Erro ao adicionar memória:", err);
      setError("Erro ao adicionar memória");
      throw err;
    }
  }, [setMemories]);

  const update = useCallback(async (id: string, updates: Partial<Memory>) => {
    try {
      const memory = await updateMemory(id, updates);
      setMemories(
        useSettingsStore
          .getState()
          .memories.map((item) => (item.id === id ? memory : item))
      );
    } catch (err) {
      console.error("[useMemories] Erro ao atualizar memória:", err);
      setError("Erro ao atualizar memória");
      throw err;
    }
  }, [setMemories]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories(
        useSettingsStore.getState().memories.filter((memory) => memory.id !== id)
      );
    } catch (err) {
      console.error("[useMemories] Erro ao remover memória:", err);
      setError("Erro ao remover memória");
      throw err;
    }
  }, [setMemories]);

  return {
    memories: memories.slice().sort((a, b) => b.priority - a.priority),
    addMemory: add,
    updateMemory: update,
    deleteMemory: remove,
    error,
  };
}
