"use client";

import { useMemo } from "react";
import { useMemories } from "@/hooks/useMemories";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";
import { estimateTokens } from "@/lib/utils/tokenEstimate";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";

export function PromptPreview() {
  const { memories } = useMemories();
  const { parameters } = useSettingsStore();
  const { contextAboutUser, responsePreferences } = useCustomInstructions();

  const preview = useMemo(() => {
    return buildSystemPrompt(
      parameters.systemPrompt,
      { id: "default", contextAboutUser, responsePreferences },
      memories
    ).systemMessage;
  }, [contextAboutUser, memories, parameters.systemPrompt, responsePreferences]);

  const tokenCount = useMemo(() => estimateTokens(preview), [preview]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-500">Preview do prompt</span>
        <span className="text-micro text-slate-400">~{tokenCount} tokens</span>
      </div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-micro text-slate-700">
        {preview || "(Sem conteúdo)"}
      </pre>
    </div>
  );
}
