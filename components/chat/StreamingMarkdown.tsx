"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";
import {
  STREAMING_MARKDOWN_SETTLE_MS,
  shouldShowStreamingMarkdownCursor,
} from "@/lib/chat/streamingMarkdown";
import type { MessageStreamStatus } from "@/types";
import { cn } from "@/lib/utils";
import {
  chatMarkdownComponents,
  chatMarkdownRehypePlugins,
  chatMarkdownRemarkPlugins,
} from "@/components/chat/chatMarkdownRenderer";

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
  const normalizedContent = normalizeChatMarkdown(content);
  const [settlingCursorVisible, setSettlingCursorVisible] = useState(
    streamStatus === "streaming"
  );

  useEffect(() => {
    if (streamStatus === "streaming") {
      const activateTimer = window.setTimeout(() => {
        setSettlingCursorVisible(true);
      }, 0);

      return () => window.clearTimeout(activateTimer);
    }

    if (!settlingCursorVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettlingCursorVisible(false);
    }, STREAMING_MARKDOWN_SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [settlingCursorVisible, streamStatus]);

  const showCursor = shouldShowStreamingMarkdownCursor(
    streamStatus,
    settlingCursorVisible
  );

  return (
    <div
      className={cn("max-w-full text-left", className)}
      aria-live="polite"
    >
      <ReactMarkdown
        remarkPlugins={chatMarkdownRemarkPlugins}
        rehypePlugins={chatMarkdownRehypePlugins}
        components={chatMarkdownComponents}
      >
        {normalizedContent}
      </ReactMarkdown>

      {showCursor ? (
        <span
          aria-hidden="true"
          data-streaming-cursor="true"
          className="mt-1 inline-flex items-center gap-1.5 text-[#D97757]"
        >
          <span className="inline-flex h-3.5 w-3.5 animate-pulse items-center justify-center rounded-full bg-[#D97757]/20">
            <span className="h-2 w-2 rounded-full bg-[#D97757]" />
          </span>
          <span className="h-4 w-[3px] animate-pulse rounded-full bg-[#D97757]" />
        </span>
      ) : null}
    </div>
  );
}
