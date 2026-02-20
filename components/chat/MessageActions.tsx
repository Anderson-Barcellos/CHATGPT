"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  content: string;
  onRegenerate?: () => void;
  className?: string;
}

export function MessageActions({ content, onRegenerate, className }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [thumbsUpActive, setThumbsUpActive] = useState(false);
  const [thumbsDownActive, setThumbsDownActive] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleThumbsUp = useCallback(() => {
    setThumbsUpActive(prev => !prev);
    if (thumbsDownActive) setThumbsDownActive(false);
  }, [thumbsDownActive]);

  const handleThumbsDown = useCallback(() => {
    setThumbsDownActive(prev => !prev);
    if (thumbsUpActive) setThumbsUpActive(false);
  }, [thumbsUpActive]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", copied ? "text-green-500" : "text-muted-foreground hover:text-foreground")}
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      {onRegenerate && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onRegenerate}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", thumbsUpActive ? "text-green-500" : "text-muted-foreground hover:text-foreground")}
        onClick={handleThumbsUp}
      >
        <ThumbsUp
          className="h-3.5 w-3.5"
          fill={thumbsUpActive ? "currentColor" : "none"}
        />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", thumbsDownActive ? "text-red-500" : "text-muted-foreground hover:text-foreground")}
        onClick={handleThumbsDown}
      >
        <ThumbsDown
          className="h-3.5 w-3.5"
          fill={thumbsDownActive ? "currentColor" : "none"}
        />
      </Button>
    </div>
  );
}
