"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseApiErrorResponse } from "@/lib/api/errors";
import { apiUrl } from "@/lib/utils";
import type { ChatModelCatalog } from "@/lib/models/chatModelCatalog";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ReasoningEffort } from "@/types";

export const chatModelCatalogKey = ["chat-model-catalog"] as const;

export type CatalogUpdate = {
  newId?: string;
  badge?: string;
  id: string;
  name: string;
  visible?: boolean;
  openAIEfforts?: ReasoningEffort[];
  webSearchEnabled?: boolean;
};

export type CatalogCommand = CatalogUpdate
  | { action: "delete"; id: string }
  | { action: "reorder"; ids: string[] }
  | { action: "badges"; badges: CatalogBadge[] };

export type CatalogBadge = { id: string; badge: string };

function catalogRequest(method: string, body: unknown) {
  return fetch(apiUrl("/api/chat/model-catalog"), {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

export async function requestBadgeSuggestions(revision: number): Promise<{ revision: number; suggestions: CatalogBadge[] }> {
  const response = await catalogRequest("POST", { action: "suggest", revision });
  if (!response.ok) throw await parseApiErrorResponse(response);
  return response.json();
}

async function readCatalogResponse(response: Response): Promise<ChatModelCatalog> {
  if (!response.ok) throw await parseApiErrorResponse(response);
  const catalog = await response.json();
  if (!Number.isSafeInteger(catalog?.revision) || !Array.isArray(catalog?.rows)) {
    throw new Error("O servidor não retornou o catálogo de modelos.");
  }
  return catalog;
}

export async function saveChatModel(update: CatalogCommand, revision: number): Promise<ChatModelCatalog> {
  const method = "action" in update ? (update.action === "delete" ? "DELETE" : "PATCH")
    : "visible" in update ? "PATCH" : "POST";
  return readCatalogResponse(await catalogRequest(method, { ...update, revision }));
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
