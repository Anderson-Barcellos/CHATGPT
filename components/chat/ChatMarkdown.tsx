"use client";

import ReactMarkdown from "react-markdown";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";
import { cn } from "@/lib/utils";
import {
  chatMarkdownComponents,
  chatMarkdownRehypePlugins,
  chatMarkdownRemarkPlugins,
} from "@/components/chat/chatMarkdownRenderer";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

export function ChatMarkdown({
  content,
  className,
}: ChatMarkdownProps) {
  const normalizedContent = normalizeChatMarkdown(content);

  return (
    <div
      className={cn(
        "max-w-full text-left",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={chatMarkdownRemarkPlugins}
        rehypePlugins={chatMarkdownRehypePlugins}
        components={chatMarkdownComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
