"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { DocumentPreviewModal } from "@/components/artifacts/DocumentPreviewModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { MonacoCodeBlock } from "@/components/chat/MonacoCodeBlock";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import {
  CANVAS_CONTENT_MODE,
  getCanvasInteractionLabel,
  getCanvasPersistenceHint,
  isCanvasContentEditable,
} from "@/lib/artifacts/canvasContract";
import type { DocumentMessageArtifact, MessageArtifact, QuizMessageArtifact } from "@/types";

interface CanvasContentProps {
  artifact: MessageArtifact;
}

function CanvasContractNotice({ artifact }: { artifact: MessageArtifact }) {
  const contentEditable = isCanvasContentEditable(artifact);

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--gc-border-soft)] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-nano font-semibold uppercase tracking-label text-muted-foreground">
          {getCanvasInteractionLabel(artifact)}
        </p>
        <p className="truncate text-micro text-muted-foreground/80">
          {getCanvasPersistenceHint(artifact)}
        </p>
      </div>
      <Badge
        variant="outline"
        className="border-primary/25 bg-primary/10 text-primary"
      >
        {contentEditable ? "editable" : CANVAS_CONTENT_MODE}
      </Badge>
    </div>
  );
}

export function CanvasContent({ artifact }: CanvasContentProps) {
  const [showSource, setShowSource] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  if (artifact.kind === "quiz") {
    return (
      <div className="flex h-full flex-col">
        <CanvasContractNotice artifact={artifact} />
        <ScrollArea className="h-full min-h-0 flex-1">
          <div className="p-4">
            <QuizCanvas artifact={artifact as QuizMessageArtifact} />
          </div>
        </ScrollArea>
      </div>
    );
  }

  const docArtifact = artifact as DocumentMessageArtifact;

  if (docArtifact.type === "html") {
    return (
      <>
        <div className="flex h-full flex-col">
          <CanvasContractNotice artifact={artifact} />
          <div className="flex shrink-0 justify-end border-b border-[color:var(--gc-border-soft)] px-3 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPreviewOpen(true)}
            >
              <Code2 className="size-3.5" />
              Visualizar A4
            </Button>
          </div>
          <iframe
            srcDoc={docArtifact.content}
            className="h-full w-full rounded-b-xl border-0 bg-white"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            title={artifact.title}
          />
        </div>
        <DocumentPreviewModal
          artifact={docArtifact}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <CanvasContractNotice artifact={artifact} />
        <div className="flex shrink-0 justify-end gap-1 border-b border-[color:var(--gc-border-soft)] px-3 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setPreviewOpen(true)}
          >
            <Code2 className="size-3.5" />
            Visualizar A4
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowSource((v) => !v)}
          >
            <Code2 className="size-3.5" />
            {showSource ? "Ver documento" : "Ver código-fonte"}
          </Button>
        </div>
        {showSource ? (
          <div className="min-h-0 flex-1">
            <MonacoCodeBlock
              language="markdown"
              value={docArtifact.content}
              readOnly
              height="100%"
            />
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <DocumentCanvas
                title={artifact.title}
                description={artifact.summary}
                eyebrow="Documento"
              >
                <ChatMarkdown content={docArtifact.content} className="max-w-none" />
              </DocumentCanvas>
            </div>
          </ScrollArea>
        )}
      </div>
      <DocumentPreviewModal
        artifact={docArtifact}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}
