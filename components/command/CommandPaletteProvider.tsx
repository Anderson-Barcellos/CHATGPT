"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

export function useCommandPaletteContext() {
  return useContext(CommandPaletteContext);
}

interface CommandPaletteProviderProps {
  children: React.ReactNode;
  onNewConversation?: () => void;
  onOpenSettings?: () => void;
}

export function CommandPaletteProvider({
  children,
  onNewConversation,
  onOpenSettings,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput =
        active?.tagName === "TEXTAREA" ||
        active?.tagName === "INPUT" ||
        (active as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "k") {
        if (isInput) return;
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onNewConversation?.();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ",") {
        e.preventDefault();
        onOpenSettings?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewConversation, onOpenSettings]);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}
