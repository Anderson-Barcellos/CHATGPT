"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { saveConversationMessages } from "@/lib/storage/conversations";
import { MessageArtifact } from "@/types";
import { useChatStore } from "@/stores/chatStore";

export function useArtifactSessionPersistence() {
  const queryClient = useQueryClient();
  const updateMessage = useChatStore((state) => state.updateMessage);

  return useCallback(
    async (messageId: string, artifact: MessageArtifact) => {
      updateMessage(messageId, { artifact });

      const { activeConversationId, messages } = useChatStore.getState();
      if (!activeConversationId) return;

      try {
        await saveConversationMessages(activeConversationId, messages);
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
        queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(activeConversationId),
        });
      } catch (error) {
        console.error("[artifact-session] Falha ao persistir artifact:", error);
        toast.error("Nao consegui salvar o estado do quiz. Tenta de novo em seguida.");
      }
    },
    [queryClient, updateMessage]
  );
}
