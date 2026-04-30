"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { MonacoCodeBlock } from "@/components/chat/MonacoCodeBlock";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import type { DocumentMessageArtifact, MessageArtifact, QuizMessageArtifact } from "@/types";

interface CanvasContentProps {
  artifact: MessageArtifact;
}

export function CanvasContent({ artifact }: CanvasContentProps) {
  const [showSource, setShowSource] = useState(false);
  if (artifact.kind === "quiz") {
    return (
      <ScrollArea className="h-full">
        <div className="p-4">
          <QuizCanvas artifact={artifact as QuizMessageArtifact} />
        </div>
      </ScrollArea>
    );
  }

  const docArtifact = artifact as DocumentMessageArtifact;

  if (docArtifact.type === "html") {
    return (
      <iframe
        srcDoc={docArtifact.content}
        className="h-full w-full rounded-b-xl border-0 bg-white"
        sandbox="allow-scripts allow-same-origin"
        title={artifact.title}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 justify-end border-b border-white/8 px-3 py-1.5">
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
  );
}
