"use client";

import {
  useConversationsQuery,
  useCreateConversationMutation,
  useDeleteConversationMutation,
} from "@/hooks/queries/useConversationQuery";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";

export function useConversations() {
  const { data: conversations = [], isLoading, error } = useConversationsQuery();
  const createMutation = useCreateConversationMutation();
  const deleteMutation = useDeleteConversationMutation();

  const createConversation = async (title?: string) => {
    return createMutation.mutateAsync(title);
  };

  const deleteConversation = async (id: string) => {
    await withConversationPersistenceRetry(() => deleteMutation.mutateAsync(id));
  };

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    deleteConversation,
  };
}
