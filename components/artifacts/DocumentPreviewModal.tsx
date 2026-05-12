"use client";

import { useCallback, useRef } from "react";
import { Download, FileDown, PanelRightOpen, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadDocumentArtifactPdf } from "@/lib/export/documentPdf";
import { openA4PrintWindow } from "@/lib/export/documentPrint";
import { downloadArtifact } from "@/lib/artifacts/exportArtifact";
import type { DocumentMessageArtifact } from "@/types";

interface DocumentPreviewModalProps {
  artifact: DocumentMessageArtifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenPanel?: () => void;
}

export function DocumentPreviewModal({
  artifact,
  open,
  onOpenChange,
  onOpenPanel,
}: DocumentPreviewModalProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!artifact) return;

    const bodyHtml =
      artifact.type === "html"
        ? artifact.content
        : (previewRef.current?.innerHTML ?? "");

    if (!bodyHtml.trim()) {
      toast.error("Nao consegui preparar a pre-visualizacao para impressao.");
      return;
    }

    const opened = openA4PrintWindow({
      title: artifact.title,
      bodyHtml,
    });

    if (!opened) {
      toast.error("Popup bloqueado. Libera popups para imprimir.");
    }
  }, [artifact]);

  const handleExportPdf = useCallback(async () => {
    if (!artifact) return;

    try {
      await downloadDocumentArtifactPdf(artifact, previewRef.current);
      toast.success("PDF exportado.");
    } catch {
      toast.error("Nao consegui exportar o PDF deste documento.");
    }
  }, [artifact]);

  if (!artifact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[98vw] max-w-none sm:max-w-[1500px] lg:max-w-[1800px] gap-4 overflow-visible border-0 bg-transparent p-0 shadow-none"
      >
        <div className="mx-auto w-full max-w-[clamp(420px,94vw,1500px)] space-y-3 md:space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[color:var(--gc-border-soft)] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] px-4 py-3 shadow-[0_12px_48px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.18))] md:px-6 md:py-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-foreground">
                {artifact.title}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex items-center gap-1.5 text-micro text-muted-foreground">
                <span>Pre-visualizacao central em proporcao A4</span>
                <Badge
                  variant="outline"
                  className="border-primary/25 bg-primary/10 text-[10px] text-primary"
                >
                  A4
                </Badge>
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1">
              {onOpenPanel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onOpenPanel}
                  title="Abrir no painel lateral"
                >
                  <PanelRightOpen className="size-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleExportPdf}
                title="Exportar PDF"
              >
                <FileDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handlePrint}
                title="Imprimir"
              >
                <Printer className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => downloadArtifact(artifact)}
                title="Baixar arquivo fonte"
              >
                <Download className="size-4" />
              </Button>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Fechar"
                >
                  <X className="size-4" />
                </Button>
              </DialogClose>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-6rem)] overflow-auto px-1 pb-2 md:max-h-[calc(100dvh-4.5rem)] md:px-2">
            <div className="mx-auto w-full max-w-[clamp(420px,94vw,1500px)]">
              <div className="mx-auto aspect-[210/297] w-full max-w-[clamp(420px,92vw,1360px)] overflow-hidden rounded-[22px] border border-[color:var(--gc-border)] bg-white shadow-[0_24px_90px_rgba(15,23,42,0.26)]">
                <div ref={previewRef} className="h-full overflow-y-auto p-2.5 md:p-4">
                  {artifact.type === "html" ? (
                    <iframe
                      srcDoc={artifact.content}
                      className="h-full w-full rounded-[14px] border-0 bg-white"
                      sandbox="allow-scripts"
                      referrerPolicy="no-referrer"
                      title={artifact.title}
                    />
                  ) : (
                  <DocumentCanvas
                    title={artifact.title}
                    description={artifact.summary}
                    eyebrow="Documento"
                    compact
                    className="h-full max-w-none rounded-none border-0 bg-transparent p-0 shadow-none dark:shadow-none"
                    pageClassName="h-full max-w-none rounded-[14px]"
                    bodyClassName="h-full overflow-y-auto"
                  >
                      <ChatMarkdown content={artifact.content} className="max-w-none" />
                    </DocumentCanvas>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
