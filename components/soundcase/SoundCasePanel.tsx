"use client";

import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SoundCaseWorkspace } from "@/components/soundcase/SoundCaseWorkspace";
import { useUIStore } from "@/stores/uiStore";

export function SoundCasePanel() {
  const soundCasePanelOpen = useUIStore((state) => state.soundCasePanelOpen);
  const setSoundCasePanelOpen = useUIStore((state) => state.setSoundCasePanelOpen);
  const closeSoundCasePanel = useUIStore((state) => state.closeSoundCasePanel);

  return (
    <Sheet open={soundCasePanelOpen} onOpenChange={setSoundCasePanelOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gc-clinical-panel w-[100vw] max-w-none gap-0 border-0 p-0 gc-safe-top sm:w-[96vw] sm:border sm:border-[color:var(--gc-border)] sm:max-w-[34rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>SoundCase</SheetTitle>
          <SheetDescription>Narração de textos longos com Luna.</SheetDescription>
        </SheetHeader>

        <div className="gc-clinical-section-header flex items-center justify-between border-b border-[color:var(--gc-border-soft)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)]">
          <div className="min-w-0">
            <h2 className="truncate text-[length:var(--gc-mobile-panel-title-font-size)] font-semibold md:text-sm">
              SoundCase
            </h2>
            <p className="text-nano uppercase tracking-label text-muted-foreground">
              narração de textos longos
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fechar SoundCase"
            className="size-[var(--gc-mobile-icon-button-size)] md:size-8"
            onClick={closeSoundCasePanel}
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>

        <SoundCaseWorkspace variant="panel" />
      </SheetContent>
    </Sheet>
  );
}
