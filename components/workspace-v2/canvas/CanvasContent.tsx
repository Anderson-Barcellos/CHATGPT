"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import type { DocumentMessageArtifact, MessageArtifact, QuizMessageArtifact } from "@/types";

interface CanvasContentProps {
  artifact: MessageArtifact;
}

export function CanvasContent({ artifact }: CanvasContentProps) {
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
    <ScrollArea className="h-full">
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
  );
}
