"use client";

import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  value: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({ 
  language, 
  value, 
  showLineNumbers = false,
  className 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [value]);

  return (
    <div className={cn("group/code relative my-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950", className)}>
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-1.5">
        <span className="text-nano font-medium uppercase tracking-wider text-zinc-400">
          {language || "code"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "0.75rem",
          lineHeight: "1.6",
        }}
        codeTagProps={{
          style: { fontSize: "inherit", fontFamily: "inherit" },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}