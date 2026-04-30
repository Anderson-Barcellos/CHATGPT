"use client";

import { useEffect, useState } from "react";

const IGNORED_TAGS = new Set(["pre", "code", "textarea", "input"]);

export interface TextSelection {
  text: string;
  messageId: string;
  rect: DOMRect;
}

export function useTextSelection(): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function handle() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }

        const text = sel.toString().trim();
        if (text.length < 10) {
          setSelection(null);
          return;
        }

        let node: Node | null = sel.anchorNode;
        let messageId: string | null = null;

        while (node) {
          const el = node as Element;
          const tag = el.tagName?.toLowerCase();
          if (tag && IGNORED_TAGS.has(tag)) {
            setSelection(null);
            return;
          }
          const mid = el.getAttribute?.("data-message-id");
          if (mid) {
            messageId = mid;
            break;
          }
          node = node.parentNode;
        }

        if (!messageId) {
          setSelection(null);
          return;
        }

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelection(null);
          return;
        }

        setSelection({ text, messageId, rect });
      }, 50);
    }

    document.addEventListener("selectionchange", handle);
    return () => {
      document.removeEventListener("selectionchange", handle);
      clearTimeout(timer);
    };
  }, []);

  return selection;
}
