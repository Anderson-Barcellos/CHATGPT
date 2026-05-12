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
  isNormalized?: boolean;
}

export function ChatMarkdown({
  content,
  className,
  isNormalized = false,
}: ChatMarkdownProps) {
  const normalizedContent = isNormalized ? content : normalizeChatMarkdown(content);

  return (
    <div
      className={cn(
        "max-w-full overflow-x-hidden break-words text-left text-body-sm [overflow-wrap:anywhere] md:text-body",
        className
      )}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={chatMarkdownRemarkPlugins}
        rehypePlugins={chatMarkdownRehypePlugins}
        components={chatMarkdownComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
