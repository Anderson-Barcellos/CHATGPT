"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSoundCaseRealtime } from "@/hooks/useSoundCaseRealtime";
import { useSoundCaseGrokRealtime } from "@/hooks/useSoundCaseGrokRealtime";
import { useOpenAILiveSpeech } from "@/hooks/useOpenAILiveSpeech";

export type SoundCaseRealtimeSession = ReturnType<typeof useSoundCaseRealtime> & {
  grok: ReturnType<typeof useSoundCaseGrokRealtime>;
  live: ReturnType<typeof useOpenAILiveSpeech>;
};

export const SoundCaseRealtimeContext = createContext<SoundCaseRealtimeSession | null>(null);

/**
 * A conexão WebRTC vive nas refs de `useSoundCaseRealtime`. Chamar o hook dentro do
 * painel faria a leitura morrer junto com o Sheet, que o Radix desmonta ao fechar;
 * por isso a sessão nasce aqui, acima do painel, e é consumida por contexto.
 */
export function SoundCaseRealtimeProvider({ children }: { children: ReactNode }) {
  const openai = useSoundCaseRealtime();
  const grok = useSoundCaseGrokRealtime();
  const live = useOpenAILiveSpeech();
  const session: SoundCaseRealtimeSession = { ...openai, grok, live };

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
