"use client";

import { AudioLines, PanelRightOpen, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSoundCaseRealtimeSession } from "@/components/soundcase/SoundCaseRealtimeProvider";
import { useUIStore } from "@/stores/uiStore";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Conectando a leitura…",
  ready: "Leitura pronta",
  speaking: "Luna está lendo",
  paused: "Leitura pausada",
};

/**
 * Controle persistente da leitura Realtime enquanto o painel do SoundCase está fechado:
 * sem ele o áudio continuaria tocando sem nenhum jeito visível de parar.
 */
export function SoundCaseRealtimeBar() {
  const realtime = useSoundCaseRealtimeSession();
  const soundCasePanelOpen = useUIStore((state) => state.soundCasePanelOpen);
  const openSoundCasePanel = useUIStore((state) => state.openSoundCasePanel);

  if (!realtime.isActive || soundCasePanelOpen) return null;

  return (
    <div
      data-slot="soundcase-realtime-bar"
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[color:var(--gc-border)] bg-[color:var(--background)] bg-[image:var(--gc-clinical-card-bg)] px-3 py-2 shadow-lg backdrop-blur"
    >
      <AudioLines className="size-4 shrink-0 text-[color:var(--primary)]" aria-hidden />
      <span className="max-w-[9rem] truncate text-xs font-medium">
        {STATUS_LABEL[realtime.status] ?? "SoundCase"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abrir SoundCase"
        className="size-8"
        onClick={openSoundCasePanel}
      >
        <PanelRightOpen className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Parar leitura"
        className="size-8"
        onClick={realtime.stop}
      >
        <Square className="size-4" />
      </Button>
    </div>
  );
}
