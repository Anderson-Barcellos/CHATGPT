"use client";

import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PulseActivityPanelV2,
  PulsePanelV2,
} from "@/components/workspace-v2/PulsePanelV2";
import { WorkspaceCapturesPanelV2 } from "@/components/workspace-v2/WorkspaceCapturesPanelV2";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type { ActivePanelTab } from "@/types";

export function ContextPanelV2() {
  const {
    activePanelTab,
    setActivePanelTab,
  } = useUIStore();
  const { activeConversationId } = useChatStore();

  return (
    <div className="flex h-full flex-col">
      <div className="gc-clinical-section-header flex items-center justify-between border-b border-[color:var(--gc-border)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)] xl:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Painel operacional</h2>
          <p className="text-nano uppercase tracking-label text-muted-foreground">
            Contexto
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("gaucho:close-context-panel"));
          }}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <Tabs
        value={activePanelTab}
        onValueChange={(v) => setActivePanelTab(v as ActivePanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="gc-clinical-section-header border-b border-[color:var(--gc-border)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Workspace</h2>
              <p className="text-nano uppercase tracking-label text-muted-foreground">
                acompanhamento em tempo real
              </p>
            </div>
          </div>
          <TabsList className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-panel-strong)] p-1">
            <TabsTrigger value="activity" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Pulse
            </TabsTrigger>
            <TabsTrigger value="notes" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Notas
            </TabsTrigger>
            <TabsTrigger value="pulse" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Rotinas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-[var(--gc-mobile-panel-content-gap)] p-[var(--gc-mobile-panel-content-pad)]">
              <PulseActivityPanelV2 />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-[var(--gc-mobile-panel-content-pad)]">
              <WorkspaceCapturesPanelV2
                context="notes"
                conversationId={activeConversationId}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pulse" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <PulsePanelV2 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
