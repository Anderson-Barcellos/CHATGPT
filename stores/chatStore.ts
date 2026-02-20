import { create } from "zustand";
import { Message } from "@/types";

interface ChatState {
  activeConversationId: string | null;
  messages: Message[];
  setActiveConversationId: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  truncateFromMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
  deleteMessagePair: (id: string) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  messages: [],
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...updates } : message
      ),
    })),
  truncateFromMessage: (id) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx === -1) return state;
      return { messages: state.messages.slice(0, idx) };
    }),
  deleteMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  deleteMessagePair: (id) =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.id === id);
      if (idx === -1) return state;
      const msg = state.messages[idx];
      if (msg.role === "user" && state.messages[idx + 1]?.role === "assistant") {
        return { messages: [...state.messages.slice(0, idx), ...state.messages.slice(idx + 2)] };
      }
      return { messages: [...state.messages.slice(0, idx), ...state.messages.slice(idx + 1)] };
    }),
  clearMessages: () => set({ messages: [] }),
}));
