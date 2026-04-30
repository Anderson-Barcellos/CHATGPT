"use client";

import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Check, Code2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonacoCodeBlock } from "@/components/chat/MonacoCodeBlock";

interface CodeBlockProps {
  language: string;
  value: string;
  showLineNumbers?: boolean;
  allowMonaco?: boolean;
  className?: string;
}

export function CodeBlock({
  language,
  value,
  showLineNumbers = false,
  allowMonaco = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showMonaco, setShowMonaco] = useState(false);

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
        <div className="flex items-center gap-0.5">
          {allowMonaco && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMonaco((v) => !v)}
              className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
              title={showMonaco ? "Ver highlight" : "Editar no Monaco"}
            >
              <Code2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
      </div>
      {showMonaco ? (
        <MonacoCodeBlock language={language} value={value} />
      ) : null}
      {!showMonaco && <SyntaxHighlighter
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
      </SyntaxHighlighter>}
    </div>
  );
}