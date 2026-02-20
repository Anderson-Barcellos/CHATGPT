"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Conversation, Message } from "@/types";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  saveConversationMessages,
} from "@/lib/storage/conversations";

export const conversationKeys = {
  all: ["conversations"] as const,
  lists: () => [...conversationKeys.all, "list"] as const,
  list: (filters?: unknown) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, "detail"] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
};

export function useConversationsQuery() {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: listConversations,
    staleTime: 1 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useConversationQuery(id: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.detail(id ?? ""),
    queryFn: () => (id ? getConversation(id) : undefined),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onMutate: async (title) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.lists(),
      });

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.lists()
      );

      const tempId = `temp-${Date.now()}`;
      const now = new Date();
      const optimisticConversation: Conversation = {
        id: tempId,
        title: title || "Nova conversa",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.lists(),
        (old) => [optimisticConversation, ...(old ?? [])]
      );

      return { previousConversations, tempId };
    },
    onError: (err, variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.lists(),
          context.previousConversations
        );
      }
    },
    onSuccess: (newId, variables, context) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(newId),
      });
    },
  });
}

export function useDeleteConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteConversation,
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.lists(),
      });

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.lists()
      );

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.lists(),
        (old) => old?.filter((conv) => conv.id !== id) ?? []
      );

      return { previousConversations };
    },
    onError: (err, variables, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.lists(),
          context.previousConversations
        );
      }
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useUpdateConversationMessagesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, messages }: { id: string; messages: Message[] }) =>
      saveConversationMessages(id, messages),
    onMutate: async ({ id, messages }) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(id),
      });

      const previousConversation = queryClient.getQueryData<Conversation>(
        conversationKeys.detail(id)
      );

      queryClient.setQueryData<Conversation>(
        conversationKeys.detail(id),
        (old) =>
          old
            ? {
                ...old,
                messages,
                updatedAt: new Date(),
              }
            : undefined
      );

      return { previousConversation };
    },
    onError: (err, variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(variables.id),
          context.previousConversation
        );
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}
