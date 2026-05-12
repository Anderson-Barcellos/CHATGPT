import type { Monaco } from "@monaco-editor/react";

export function registerMonacoThemes(monaco: Monaco) {
  monaco.editor.defineTheme("gc-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0d1724",
      "editor.foreground": "#d7e1e8",
      "editorLineNumber.foreground": "#43566a",
      "editorLineNumber.activeForeground": "#83a6b5",
      "editor.selectionBackground": "#0f6f8655",
      "editor.lineHighlightBackground": "#132233",
      "editorWidget.background": "#132233",
      "editorWidget.border": "#24435e",
      "editorSuggestWidget.background": "#132233",
      "editorSuggestWidget.border": "#24435e",
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
      "editor.background": "#f7fafb",
      "editor.foreground": "#162536",
      "editorLineNumber.foreground": "#8da0ae",
      "editorLineNumber.activeForeground": "#4f6a7a",
      "editor.selectionBackground": "#b9dfe8",
      "editor.lineHighlightBackground": "#edf5f7",
      "editorWidget.background": "#f7fafb",
      "editorWidget.border": "#d3e0e4",
      "scrollbarSlider.background": "#cbd5e180",
      "scrollbarSlider.hoverBackground": "#94a3b8aa",
    },
  });
}

export function getMonacoTheme(): "gc-dark" | "gc-light" {
  if (typeof document === "undefined") return "gc-dark";
  return document.documentElement.classList.contains("dark") ? "gc-dark" : "gc-light";
}
