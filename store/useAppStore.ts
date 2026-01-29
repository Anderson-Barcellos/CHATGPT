
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppMode, AppSettings, Conversation, DEFAULT_SETTINGS, Memory, Message, Role } from '../types';

interface AppState {
  // Navigation
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  createConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  
  // Messages
  addMessage: (conversationId: string, role: Role, content: string) => Message;
  updateMessageContent: (conversationId: string, messageId: string, content: string) => void;
  setStreamingStatus: (conversationId: string, messageId: string, isStreaming: boolean) => void;
  
  // Settings & Memories
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  memories: Memory[];
  addMemory: (content: string, category: Memory['category']) => void;
  toggleMemory: (id: string) => void;
  removeMemory: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeMode: 'chat',
      setActiveMode: (mode) => set({ activeMode: mode }),
      
      conversations: [],
      activeConversationId: null,
      
      createConversation: () => {
        const newConv: Conversation = {
          id: crypto.randomUUID(),
          title: 'New Conversation',
          messages: [],
          updatedAt: Date.now(),
          mode: get().activeMode
        };
        set(state => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: newConv.id
        }));
      },
      
      selectConversation: (id) => set({ activeConversationId: id }),
      
      deleteConversation: (id) => set(state => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
      })),

      updateConversationTitle: (id, title) => set(state => ({
        conversations: state.conversations.map(c => c.id === id ? { ...c, title } : c)
      })),
      
      addMessage: (conversationId, role, content) => {
        const newMessage: Message = {
          id: crypto.randomUUID(),
          role,
          content,
          timestamp: Date.now(),
          isStreaming: role === 'assistant' // Default true for assistant
        };
        
        set(state => ({
          conversations: state.conversations.map(c => {
            if (c.id !== conversationId) return c;
            
            // Auto-title on first user message
            let title = c.title;
            if (c.messages.length === 0 && role === 'user') {
              title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
            }
            
            return {
              ...c,
              title,
              messages: [...c.messages, newMessage],
              updatedAt: Date.now()
            };
          })
        }));
        return newMessage;
      },
      
      updateMessageContent: (conversationId, messageId, content) => set(state => ({
        conversations: state.conversations.map(c => 
          c.id === conversationId 
            ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, content } : m) }
            : c
        )
      })),
      
      setStreamingStatus: (conversationId, messageId, isStreaming) => set(state => ({
        conversations: state.conversations.map(c => 
          c.id === conversationId 
            ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isStreaming } : m) }
            : c
        )
      })),
      
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) => set(state => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      memories: [],
      addMemory: (content, category) => set(state => ({
        memories: [...state.memories, {
          id: crypto.randomUUID(),
          content,
          category,
          isActive: true
        }]
      })),
      
      toggleMemory: (id) => set(state => ({
        memories: state.memories.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m)
      })),
      
      removeMemory: (id) => set(state => ({
        memories: state.memories.filter(m => m.id !== id)
      })),
    }),
    {
      name: 'nexus-ai-storage-v4', // Incremented for new settings structure
      partialize: (state) => ({ 
        conversations: state.conversations, 
        settings: state.settings,
        memories: state.memories 
      }),
    }
  )
);
