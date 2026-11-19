"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";
import type { ChatModelCatalog } from "@/lib/models/chatModelCatalog";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ReasoningEffort } from "@/types";

export const chatModelCatalogKey = ["chat-model-catalog"] as const;

type CatalogUpdate = {
  revision: number;
  id: string;
  name: string;
  visible?: boolean;
  openAIEfforts?: ReasoningEffort[];
};

async function readCatalogResponse(response: Response): Promise<ChatModelCatalog> {
  if (!response.ok) throw await parseApiErrorResponse(response);
  const catalog = await response.json();
  if (!Number.isSafeInteger(catalog?.revision) || !Array.isArray(catalog?.rows)) {
    throw new Error("O servidor não retornou o catálogo de modelos.");
  }
  return catalog;
}

export async function saveChatModel(update: CatalogUpdate): Promise<ChatModelCatalog> {
  const response = await fetch(apiUrl("/api/chat/model-catalog"), {
    method: "visible" in update ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  return readCatalogResponse(response);
}

export function useChatModelCatalog() {
  const query = useQuery({
    queryKey: chatModelCatalogKey,
    queryFn: async ({ signal }): Promise<ChatModelCatalog> => {
      const response = await fetch(apiUrl("/api/chat/model-catalog"), { signal, cache: "no-store" });
      return readCatalogResponse(response);
    },
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const catalog = query.data;
  useEffect(() => {
    if (catalog) useSettingsStore.getState().setChatModelCatalog(catalog);
  }, [catalog]);
  return query;
}
