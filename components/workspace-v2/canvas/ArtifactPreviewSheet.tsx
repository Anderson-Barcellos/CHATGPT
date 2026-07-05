"use client";

import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { FileDown, Download, X } from "lucide-react";
import { toast } from "sonner";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CANVAS_CONTENT_MODE } from "@/lib/artifacts/canvasContract";
import { downloadDocumentArtifactPdf } from "@/lib/export/documentPdf";
import { downloadArtifact } from "@/lib/artifacts/exportArtifact";
import type { DocumentMessageArtifact, MessageArtifact, QuizMessageArtifact } from "@/types";

interface ArtifactPreviewSheetProps {
  artifact: MessageArtifact;
  onClose: () => void;
}

const ACTION_BUTTON_CLASS = "size-8 shrink-0 rounded-lg";

const A4_PAGE_FRAME_CLASS =
  "mx-auto aspect-[210/297] w-full max-w-[760px] overflow-hidden rounded-[14px] border border-[color:var(--gc-border)] bg-white shadow-[0_8px_40px_rgba(15,23,42,0.16)]";

function SheetOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    />
  );
}

export function ArtifactPreviewSheet({ artifact, onClose }: ArtifactPreviewSheetProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const docArtifact =
    artifact.kind === "document" ? (artifact as DocumentMessageArtifact) : null;

  const handleExportPdf = useCallback(async () => {
    if (!docArtifact) return;

    try {
      await downloadDocumentArtifactPdf(docArtifact, previewRef.current);
      toast.success("PDF exportado.");
    } catch {
      toast.error("Não consegui exportar o PDF deste documento.");
    }
  }, [docArtifact]);

  return (
    <>
      <SheetOverlay onClose={onClose} />

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-50 md:bottom-2"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
      >
        <div className="mx-auto w-full max-w-3xl px-3 md:max-w-3xl md:px-4 lg:max-w-5xl">
          <div className="pointer-events-auto flex max-h-[calc(100dvh-0.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-panel)] shadow-[0_-12px_60px_rgba(15,23,42,0.28)] md:max-h-[calc(100dvh-1rem)]">
            {/* Header */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-[color:var(--gc-border-soft)] px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between md:px-4 md:py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {artifact.title}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-micro text-muted-foreground">
                    {artifact.kind === "quiz" ? "Quiz interativo" : "Pré-visualização A4"}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-primary/25 bg-primary/10 text-[10px] text-primary"
                  >
                    {artifact.kind === "quiz" ? "Quiz" : "A4"}
                  </Badge>
                  {artifact.kind === "document" && (
                    <Badge
                      variant="outline"
                      className="hidden border-primary/25 bg-primary/10 text-[10px] text-primary sm:inline-flex"
                    >
                      {CANVAS_CONTENT_MODE}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 self-end sm:self-auto">
                {docArtifact && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={ACTION_BUTTON_CLASS}
                      onClick={handleExportPdf}
                      title="Exportar PDF"
                    >
                      <FileDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={ACTION_BUTTON_CLASS}
                      onClick={() => {
                        downloadArtifact(artifact);
                      }}
                      title="Baixar arquivo fonte"
                    >
                      <Download className="size-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={ACTION_BUTTON_CLASS}
                  onClick={onClose}
                  title="Fechar"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:px-4 md:pt-3">
              {artifact.kind === "quiz" ? (
                <div className="mx-auto w-full max-w-5xl">
                  <QuizCanvas
                    artifact={artifact as QuizMessageArtifact}
                    compact
                    className="max-w-none rounded-[14px] p-2 md:p-3"
                  />
                </div>
              ) : docArtifact?.type === "html" ? (
                <div className={A4_PAGE_FRAME_CLASS}>
                  <iframe
                    srcDoc={docArtifact.content}
                    className="h-full w-full border-0 bg-white"
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                    title={artifact.title}
                  />
                </div>
              ) : (
                <div className={A4_PAGE_FRAME_CLASS}>
                  <div ref={previewRef} className="h-full touch-pan-y overflow-y-auto overflow-x-hidden p-2.5 md:p-3">
                    <DocumentCanvas
                      title={artifact.title}
                      description={artifact.summary}
                      eyebrow="Documento"
                      compact
                      className="h-full max-w-none rounded-none border-0 bg-transparent p-0 shadow-none dark:shadow-none"
                      pageClassName="h-full max-w-none rounded-[14px]"
                      bodyClassName="h-full overflow-y-auto px-4 py-5 md:px-7 md:py-7"
                    >
                      <ChatMarkdown
                        content={docArtifact!.content}
                        className="max-w-none break-words [overflow-wrap:anywhere]"
                      />
                    </DocumentCanvas>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
