"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { cn } from "@/lib/utils";

interface ChatMarkdownProps {
  content: string;
  className?: string;
  allowHtml?: boolean;
}

export function ChatMarkdown({
  content,
  className,
  allowHtml = false,
}: ChatMarkdownProps) {
  const renderCode: Components["code"] = ({
    className,
    children,
    ...props
  }) => {
    const match = /language-([\w-]+)/.exec(className || "");
    const language = match ? match[1] : "";
    const isInline = !className || !match;

    if (!isInline && language) {
      return (
        <CodeBlock
          language={language}
          value={String(children).replace(/\n$/, "")}
        />
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div
      className={cn(
        "prose prose-slate dark:prose-invert max-w-full prose-sm text-left",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={
          allowHtml
            ? [rehypeHighlight, rehypeKatex, rehypeRaw]
            : [rehypeHighlight, rehypeKatex]
        }
        components={{
          code: renderCode,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
