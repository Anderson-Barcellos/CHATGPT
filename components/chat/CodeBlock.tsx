"use client";

import { useState, useCallback } from "react";
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

  const lines = value.split('\n');

  return (
    <div className={cn("group/code relative my-3 overflow-hidden rounded-lg border bg-zinc-950", className)}>
      {language && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            {language}
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
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-zinc-100">
        {showLineNumbers ? (
          <table className="w-full">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="select-none pr-4 text-right text-zinc-500">
                    {i + 1}
                  </td>
                  <td>
                    <code>{line || ' '}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <code>{value}</code>
        )}
      </pre>
      {!language && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute right-2 top-2 h-6 w-6 text-zinc-500 opacity-0 group-hover/code:opacity-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}