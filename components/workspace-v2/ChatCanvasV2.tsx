"use client";

import { ChatContainer } from "@/components/chat/ChatContainer";
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
  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0)_32%)]">
      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        editAndResend={editAndResend}
        deleteMessage={deleteMessage}
      />
    </div>
  );
}
