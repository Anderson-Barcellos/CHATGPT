import { create } from "zustand";
import { calculateCost, formatCost } from "@/lib/models/modelConfig";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { Message } from "@/types";

interface CostState {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  recalculate: (messages: Message[], modelId: string) => void;
}

export const useCostStore = create<CostState>((set) => ({
  totalCost: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  reasoningTokens: 0,

  recalculate: (messages: Message[], modelId: string) => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let reasoningTokens = 0;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      if (msg.inputTokens) inputTokens += msg.inputTokens;
      if (msg.outputTokens) outputTokens += msg.outputTokens;
      if (msg.cachedTokens) cachedTokens += msg.cachedTokens;
      if (msg.reasoningTokens) reasoningTokens += msg.reasoningTokens;
    }

    const uncachedInput = Math.max(0, inputTokens - cachedTokens);
    const usage = calculateCost(uncachedInput + cachedTokens, outputTokens, modelId, cachedTokens);

    set({
      totalCost: usage.totalCost,
      inputTokens,
      outputTokens,
      cachedTokens,
      reasoningTokens,
    });
  },
}));

export function useCostDisplay() {
  const { totalCost, inputTokens, outputTokens, cachedTokens } = useCostStore();
  const modelId = useSettingsStore((s) => s.parameters.model);

  const formatted = formatCost(totalCost);

  const totalTokens = inputTokens + outputTokens;
  const cachePct = totalTokens > 0 ? Math.round((cachedTokens / totalTokens) * 100) : 0;

  return {
    formattedCost: formatted,
    totalTokens,
    cachePct,
    modelId,
  };
}

export function syncCostFromMessages(messages: Message[]) {
  const modelId = useSettingsStore.getState().parameters.model;
  useCostStore.getState().recalculate(messages, modelId);
}
