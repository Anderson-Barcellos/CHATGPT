"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Monaco } from "@monaco-editor/react";
import { registerMonacoThemes, getMonacoTheme } from "@/lib/monaco/theme";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => ({ default: m.Editor })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-b-lg bg-zinc-900" />
    ),
  },
);

interface MonacoCodeBlockProps {
  language?: string;
  value: string;
  readOnly?: boolean;
  height?: number | string;
  className?: string;
}

export function MonacoCodeBlock({
  language = "plaintext",
  value,
  readOnly = false,
  height = "auto",
  className,
}: MonacoCodeBlockProps) {
  const [theme, setTheme] = useState<"gc-dark" | "gc-light">(getMonacoTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getMonacoTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const lineCount = value.split("\n").length;
  const computedHeight =
    height === "auto" ? Math.min(Math.max(lineCount * 20 + 28, 80), 480) : height;

  function beforeMount(monaco: Monaco) {
    registerMonacoThemes(monaco);
  }

  return (
    <div style={{ height: computedHeight }} className={className}>
      <MonacoEditor
        theme={theme}
        language={language}
        value={value}
        beforeMount={beforeMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontFamily: "'Geist Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 13,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          wordWrap: "on",
          renderLineHighlight: readOnly ? "none" : "line",
          scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          contextmenu: false,
        }}
      />
    </div>
  );
}
