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
import { Children, isValidElement, ReactElement, ReactNode } from "react";

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children);
  }
  return Children.toArray(node).map(extractText).join("");
}

function isCodeElement(
  node: ReactNode
): node is ReactElement<{ className?: string; children?: ReactNode }> {
  return isValidElement(node) && node.type === "code";
}

function getCodeBlockProps(children: ReactNode) {
  const codeChild = Children.toArray(children).find(isCodeElement);
  if (!codeChild) return null;

  const className = codeChild.props.className ?? "";
  const match = /language-([\w-]+)/.exec(className);

  return {
    language: match ? match[1] : "",
    value: extractText(codeChild.props.children).replace(/\n$/, ""),
  };
}

interface ChatMarkdownProps {
  content: string;
  className?: string;
  allowHtml?: boolean;
  preserveLineBreaks?: boolean;
  variant?: "chat" | "document";
}

export function ChatMarkdown({
  content,
  className,
  allowHtml = false,
  preserveLineBreaks = false,
  variant = "chat",
}: ChatMarkdownProps) {
  const remarkPlugins = preserveLineBreaks
    ? [remarkGfm, remarkMath, remarkBreaks]
    : [remarkGfm, remarkMath];

  const renderCode: Components["code"] = ({
    className,
    children,
    ...props
  }) => {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  const renderPre: Components["pre"] = ({
    children,
    ...props
  }) => {
    const codeBlock = getCodeBlockProps(children);

    if (codeBlock) {
      return (
        <CodeBlock
          language={codeBlock.language}
          value={codeBlock.value}
          className="not-prose"
        />
      );
    }

    return <pre {...props}>{children}</pre>;
  };

  return (
    <div
      className={cn(
        "prose prose-slate dark:prose-invert max-w-full prose-sm text-left",
        variant === "document" && [
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:mb-5 prose-h1:text-[2rem] prose-h1:leading-[1.08] prose-h1:text-foreground",
          "prose-h2:mt-11 prose-h2:mb-3 prose-h2:text-[1.45rem] prose-h2:leading-[1.15] prose-h2:text-foreground",
          "prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-[1.08rem] prose-h3:leading-[1.25] prose-h3:text-foreground/95",
          "prose-p:my-4 prose-p:leading-7 prose-p:text-foreground/88",
          "prose-strong:text-foreground",
          "prose-hr:my-10 prose-hr:border-white/10",
          "prose-ul:my-4 prose-ol:my-4",
          "prose-li:my-1.5 prose-li:leading-7 prose-li:text-foreground/84",
          "prose-blockquote:my-6 prose-blockquote:border-l-[3px] prose-blockquote:border-l-cyan-400/55 prose-blockquote:bg-cyan-500/[0.04] prose-blockquote:px-5 prose-blockquote:py-2 prose-blockquote:text-foreground/78",
          "prose-table:my-7 prose-th:border-b prose-th:border-white/10 prose-th:bg-white/[0.04] prose-th:px-3 prose-th:py-2 prose-th:text-left",
          "prose-td:border-b prose-td:border-white/5 prose-td:px-3 prose-td:py-2",
          "prose-code:rounded prose-code:bg-slate-900/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em]",
          "dark:prose-code:bg-white/[0.08]",
        ],
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={
          allowHtml
            ? [rehypeHighlight, rehypeKatex, rehypeRaw]
            : [rehypeHighlight, rehypeKatex]
        }
        components={{
          code: renderCode,
          pre: renderPre,
          h1: ({ children, className, ...rest }) => (
            <h1 className={cn("mt-5 mb-3 text-xl font-bold tracking-tight text-foreground", className)} {...rest}>
              {children}
            </h1>
          ),
          h2: ({ children, className, ...rest }) => (
            <h2 className={cn("mt-5 mb-2 text-lg font-semibold tracking-tight text-foreground", className)} {...rest}>
              {children}
            </h2>
          ),
          h3: ({ children, className, ...rest }) => (
            <h3 className={cn("mt-4 mb-2 text-base font-semibold text-foreground/95", className)} {...rest}>
              {children}
            </h3>
          ),
          h4: ({ children, className, ...rest }) => (
            <h4 className={cn("mt-3 mb-1.5 text-sm font-semibold text-foreground/90", className)} {...rest}>
              {children}
            </h4>
          ),
          h5: ({ children, className, ...rest }) => (
            <h5 className={cn("mt-3 mb-1 text-sm font-medium text-foreground/85", className)} {...rest}>
              {children}
            </h5>
          ),
          h6: ({ children, className, ...rest }) => (
            <h6 className={cn("mt-2 mb-1 text-xs font-medium uppercase tracking-wider text-foreground/75", className)} {...rest}>
              {children}
            </h6>
          ),
          ul: ({ children, className, ...rest }) => (
            <ul className={cn("my-3 list-disc space-y-1 pl-5", className)} {...rest}>
              {children}
            </ul>
          ),
          ol: ({ children, className, ...rest }) => (
            <ol className={cn("my-3 list-decimal space-y-1 pl-5", className)} {...rest}>
              {children}
            </ol>
          ),
          li: ({ children, className, ...rest }) => (
            <li className={cn("pl-1", className)} {...rest}>
              {children}
            </li>
          ),
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              {...rest}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...rest }) => (
            // eslint-disable-next-line @next/next/no-img-element -- markdown pode conter imagens dinamicas e externas
            <img
              src={src}
              alt={alt}
              className="h-auto max-w-full rounded-lg shadow-md"
              loading="lazy"
              {...rest}
            />
          ),
          table: ({ children, ...rest }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...rest}>
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
