"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useCostStore } from "@/stores/costStore";

export function useCostSync() {
  const messages = useChatStore((s) => s.messages);
  const modelId = useSettingsStore((s) => s.parameters.model);
  const recalculate = useCostStore((s) => s.recalculate);

  useEffect(() => {
    recalculate(messages, modelId);
  }, [messages, modelId, recalculate]);
}
