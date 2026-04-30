"use client";

import { useState } from "react";
import { useMemories } from "@/hooks/useMemories";
import { MEMORY_CATEGORIES, MemoryCategory } from "@/types";

export function MemoryManager() {
  const { memories, addMemory, updateMemory, deleteMemory } = useMemories();
  const [newMemory, setNewMemory] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("other");

  const handleAdd = async () => {
    if (!newMemory.trim()) return;
    await addMemory({
      content: newMemory.trim(),
      category,
      isActive: true,
      priority: memories.length,
    });
    setNewMemory("");
  };

  const activeCount = memories.filter((memory) => memory.isActive).length;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Memórias</h3>
        <span className="text-xs text-slate-400">
          {activeCount} de {memories.length} ativas
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as MemoryCategory)}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
        >
          {Object.entries(MEMORY_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          value={newMemory}
          onChange={(event) => setNewMemory(event.target.value)}
          placeholder="Adicionar nova memória..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
        />
        <button
          onClick={handleAdd}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
        >
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {memories.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhuma memória adicionada ainda.
          </p>
        ) : (
          memories.map((memory) => (
            <div
              key={memory.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                memory.isActive
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-100 bg-slate-50/60 text-slate-400"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-600">
                    {MEMORY_CATEGORIES[memory.category]}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-500">
                    {memory.content}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() =>
                      updateMemory(memory.id, { isActive: !memory.isActive })
                    }
                    className="rounded-full border border-slate-200 px-2 py-1 text-nano text-slate-500"
                  >
                    {memory.isActive ? "Ativa" : "Inativa"}
                  </button>
                  <button
                    onClick={() => deleteMemory(memory.id)}
                    className="text-nano text-red-400 hover:text-red-500"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
