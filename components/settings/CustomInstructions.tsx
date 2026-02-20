"use client";

import { useState } from "react";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import { PromptPreview } from "@/components/settings/PromptPreview";

export function CustomInstructions() {
  const { contextAboutUser, updateContextAboutUser } = useCustomInstructions();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Instruções customizadas
        </h3>
        <button
          onClick={() => setShowPreview((prev) => !prev)}
          className="text-xs text-slate-500 hover:text-slate-600"
        >
          {showPreview ? "Ocultar" : "Preview"}
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-600">
        Sobre você
        <textarea
          rows={4}
          value={contextAboutUser}
          onChange={(event) => updateContextAboutUser(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
          placeholder="O que a IA deveria saber sobre você?"
        />
      </label>

      {showPreview && <PromptPreview />}
    </div>
  );
}
