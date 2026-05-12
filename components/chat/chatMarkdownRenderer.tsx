"use client";

import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "@/components/chat/CodeBlock";

export const chatMarkdownRemarkPlugins = [
  remarkGfm,
  remarkMath,
  remarkBreaks,
];

export const chatMarkdownRehypePlugins = [rehypeKatex];

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

export const chatMarkdownComponents: Components = {
  code: renderCode,
  h1: ({ children }) => (
    <h1 className="mt-5 mb-3 text-lg font-bold tracking-tight text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold text-foreground/95">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1.5 text-sm font-semibold text-foreground/90">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-3 mb-1 text-sm font-medium text-foreground/85">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2 mb-1 text-xs font-medium uppercase tracking-wider text-foreground/75">
      {children}
    </h6>
  ),
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-[3px] border-l-primary/50 bg-primary/[0.04] px-4 py-2 text-foreground/80 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-[color:var(--gc-border-soft)]" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
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
      <table className="min-w-full divide-y divide-border text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border bg-muted/45 px-3 py-2 text-left text-xs font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/70 px-3 py-2">{children}</td>
  ),
};
