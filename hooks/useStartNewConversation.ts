"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/stores/chatStore";

/**
 * Abre uma conversa nova de verdade (cria no servidor e ativa o id), em vez de
 * só zerar o id ativo e cair na tela de recovery (B3). Respeita a mesma trava
 * de stream em curso do rail.
 */
export function useStartNewConversation() {
  const { createConversation } = useConversations();
  const { isStreaming, setActiveConversationId } = useChatStore();

  return useCallback(async (): Promise<string | null> => {
    if (isStreaming) {
      toast.info("Aguarde a resposta terminar para trocar de conversa.");
      return null;
    }
    try {
      const id = await createConversation("Nova conversa");
      setActiveConversationId(id);
      return id;
    } catch (creationError) {
      console.error("[useStartNewConversation] Falha ao criar conversa:", creationError);
      toast.error("Nao consegui abrir uma nova conversa agora.");
      return null;
    }
  }, [createConversation, isStreaming, setActiveConversationId]);
}
