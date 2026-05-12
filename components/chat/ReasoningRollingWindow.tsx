"use client";

import { useEffect, useRef } from "react";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import styles from "./ReasoningRollingWindow.module.css";

interface ReasoningRollingWindowProps {
  content: string;
  isNormalized?: boolean;
}

export function ReasoningRollingWindow({
  content,
  isNormalized = false,
}: ReasoningRollingWindowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [content]);

  return (
    <div className={styles.window} aria-live="polite">
      <div ref={scrollerRef} className={styles.scroller}>
        <div className={styles.content}>
          <ChatMarkdown
            content={content}
            className="text-micro leading-5 text-foreground/70 md:text-caption md:leading-6"
            isNormalized={isNormalized}
          />
        </div>
      </div>
    </div>
  );
}
