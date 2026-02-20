"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { addMemory, deleteMemory, listMemories, updateMemory } from "@/lib/storage/memories";
import { Memory, MemoryCategory } from "@/types";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function useMemories() {
  const [error, setError] = useState<string | null>(null);
  
  // useLiveQuery com tratamento de erros
  const memories = useLiveQuery(
    async () => {
      try {
        return await listMemories();
      } catch (err) {
        console.error("[useMemories] Erro ao listar memórias:", err);
        setError("Erro ao carregar memórias");
        return [];
      }
    },
    [],
    [] // valor padrão se falhar
  );

  useEffect(() => {
    if (memories && memories.length > 0) {
      try {
        useSettingsStore.getState().setMemories(memories);
      } catch (err) {
        console.error("[useMemories] Erro ao sincronizar memórias:", err);
      }
    }
  }, [memories]);

  const add = async (input: {
    content: string;
    category: MemoryCategory;
    isActive: boolean;
    priority: number;
  }) => {
    try {
      return await addMemory(input);
    } catch (err) {
      console.error("[useMemories] Erro ao adicionar memória:", err);
      setError("Erro ao adicionar memória");
      throw err;
    }
  };

  const update = async (id: string, updates: Partial<Memory>) => {
    try {
      return await updateMemory(id, updates);
    } catch (err) {
      console.error("[useMemories] Erro ao atualizar memória:", err);
      setError("Erro ao atualizar memória");
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      return await deleteMemory(id);
    } catch (err) {
      console.error("[useMemories] Erro ao remover memória:", err);
      setError("Erro ao remover memória");
      throw err;
    }
  };

  return {
    memories: (memories ?? []).slice().sort((a, b) => b.priority - a.priority),
    addMemory: add,
    updateMemory: update,
    deleteMemory: remove,
    error,
  };
}
