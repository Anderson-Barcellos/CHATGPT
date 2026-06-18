"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import { toast } from "sonner";
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
    if (!implRef.current) {
      toast.error("Painel de notas não está disponível.");
      return;
    }
    implRef.current(text, sourceMessageId);
    useUIStore.getState().setActivePanelTab("activity");
  }, []);

  const _register = useCallback((fn: AppendFn) => {
    implRef.current = fn;
    return () => {
      // Só nulifica se esta instância ainda é a registrada — evita que o cleanup de uma
      // instância que desmonta sobrescreva o registro de outra que acabou de montar
      if (implRef.current === fn) {
        implRef.current = null;
      }
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
