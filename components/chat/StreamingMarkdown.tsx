"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";
import { shouldShowStreamingMarkdownCursor } from "@/lib/chat/streamingMarkdown";
import { useStreamingTextBuffer } from "@/lib/chat/useStreamingTextBuffer";
import {
  STREAMING_CURSOR_TAG,
  rehypeStreamingCursor,
} from "@/lib/chat/rehypeStreamingCursor";
import type { MessageStreamStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  chatMarkdownComponents,
  chatMarkdownRehypePlugins,
  chatMarkdownRemarkPlugins,
} from "@/components/chat/chatMarkdownRenderer";
import { StreamingCursor } from "@/components/chat/StreamingCursor";

interface StreamingMarkdownProps {
  content: string;
  className?: string;
  streamStatus?: MessageStreamStatus;
}

export function StreamingMarkdown({
  content,
  className,
  streamStatus,
}: StreamingMarkdownProps) {
  const { displayed, isSettling } = useStreamingTextBuffer({
    content,
    streamStatus,
  });

  const normalizedContent = normalizeChatMarkdown(displayed);

  const showCursor = shouldShowStreamingMarkdownCursor(
    streamStatus,
    isSettling
  );

  const rehypePlugins = useMemo(
    () =>
      showCursor
        ? [...chatMarkdownRehypePlugins, rehypeStreamingCursor]
        : chatMarkdownRehypePlugins,
    [showCursor]
  );

  const components = useMemo(
    () =>
      ({
        ...chatMarkdownComponents,
        [STREAMING_CURSOR_TAG]: StreamingCursor,
      }) as Components,
    []
  );

  return (
    <div
      className={cn("max-w-full text-left", className)}
      aria-live="polite"
    >
      <ReactMarkdown
        remarkPlugins={chatMarkdownRemarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
