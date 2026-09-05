"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSoundCaseRealtime } from "@/hooks/useSoundCaseRealtime";

export type SoundCaseRealtimeSession = ReturnType<typeof useSoundCaseRealtime>;

export const SoundCaseRealtimeContext = createContext<SoundCaseRealtimeSession | null>(null);

/**
 * A conexão WebRTC vive nas refs de `useSoundCaseRealtime`. Chamar o hook dentro do
 * painel faria a leitura morrer junto com o Sheet, que o Radix desmonta ao fechar;
 * por isso a sessão nasce aqui, acima do painel, e é consumida por contexto.
 */
export function SoundCaseRealtimeProvider({ children }: { children: ReactNode }) {
  const session = useSoundCaseRealtime();

  return (
    <SoundCaseRealtimeContext.Provider value={session}>
      {children}
    </SoundCaseRealtimeContext.Provider>
  );
}

export function useSoundCaseRealtimeSession(): SoundCaseRealtimeSession {
  const session = useContext(SoundCaseRealtimeContext);
  if (!session) {
    throw new Error("useSoundCaseRealtimeSession precisa de um SoundCaseRealtimeProvider acima.");
  }
  return session;
}
