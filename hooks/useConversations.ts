"use client";

import {
  useConversationsQuery,
  useCreateConversationMutation,
  useDeleteConversationMutation,
} from "@/hooks/queries/useConversationQuery";

export function useConversations() {
  const { data: conversations = [], isLoading, error } = useConversationsQuery();
  const createMutation = useCreateConversationMutation();
  const deleteMutation = useDeleteConversationMutation();

  const createConversation = async (title?: string) => {
    try {
      const id = await createMutation.mutateAsync(title);
      return id;
    } catch (err) {
      console.error("[useConversations] Erro ao criar conversa:", err);
      // Retorna ID temporário se falhar
      return `temp-${Date.now()}`;
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error("[useConversations] Erro ao deletar conversa:", err);
      // Não propaga o erro para não quebrar a UI
    }
  };

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    deleteConversation,
  };
}
