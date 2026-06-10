"use client";

import { AnimatePresence } from "framer-motion";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ArtifactPreviewSheet } from "@/components/workspace-v2/canvas/ArtifactPreviewSheet";
import { useUIStore } from "@/stores/uiStore";
import type { Message } from "@/types";

interface ChatCanvasV2Props {
  messages: Message[];
  isLoading: boolean;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

export function ChatCanvasV2({
  messages,
  isLoading,
  editAndResend,
  deleteMessage,
}: ChatCanvasV2Props) {
  const { artifactOpen, activeArtifact, closeArtifact } = useUIStore();

  return (
    <div className="gc-clinical-canvas relative flex h-full min-h-0 flex-col">
      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        editAndResend={editAndResend}
        deleteMessage={deleteMessage}
      />

      <AnimatePresence>
        {artifactOpen && activeArtifact && (
          <ArtifactPreviewSheet
            artifact={activeArtifact}
            onClose={closeArtifact}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
