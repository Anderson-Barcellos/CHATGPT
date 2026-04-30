"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";

type AppendFn = (text: string, sourceMessageId: string) => void;

interface NotesContextValue {
  appendToNotes: AppendFn;
  _register: (fn: AppendFn) => () => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const implRef = useRef<AppendFn | null>(null);

  const appendToNotes = useCallback((text: string, sourceMessageId: string) => {
    implRef.current?.(text, sourceMessageId);
    useUIStore.getState().setActivePanelTab("notes");
  }, []);

  const _register = useCallback((fn: AppendFn) => {
    implRef.current = fn;
    return () => {
      implRef.current = null;
    };
  }, []);

  return (
    <NotesContext.Provider value={{ appendToNotes, _register }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotesContext() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within NotesProvider");
  return ctx;
}
