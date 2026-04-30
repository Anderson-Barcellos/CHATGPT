import type { Monaco } from "@monaco-editor/react";

export function registerMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme("gc-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#080e1a",
      "editor.foreground": "#cbd5e1",
      "editorLineNumber.foreground": "#334155",
      "editorLineNumber.activeForeground": "#64748b",
      "editor.selectionBackground": "#1e3a5f80",
      "editor.lineHighlightBackground": "#0f172a",
      "editorWidget.background": "#0f172a",
      "editorWidget.border": "#1e293b",
      "editorSuggestWidget.background": "#0f172a",
      "editorSuggestWidget.border": "#1e293b",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#33415580",
      "scrollbarSlider.hoverBackground": "#475569aa",
    },
  });

  monaco.editor.defineTheme("gc-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#f8fafc",
      "editor.foreground": "#1e293b",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#64748b",
      "editor.selectionBackground": "#bfdbfe",
      "editor.lineHighlightBackground": "#f1f5f9",
      "editorWidget.background": "#f8fafc",
      "editorWidget.border": "#e2e8f0",
      "scrollbarSlider.background": "#cbd5e180",
      "scrollbarSlider.hoverBackground": "#94a3b8aa",
    },
  });
}

export function getMonacoTheme(): "gc-dark" | "gc-light" {
  if (typeof document === "undefined") return "gc-dark";
  return document.documentElement.classList.contains("dark") ? "gc-dark" : "gc-light";
}
