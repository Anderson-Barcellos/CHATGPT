export type NotebookRichOutputView =
  | { kind: "image"; mime: string; src: string }
  | { kind: "html"; html: string }
  | { kind: "latex"; source: string }
  | { kind: "markdown"; source: string }
  | { kind: "text"; text: string };

const BASE64_IMAGE_MIMES = ["image/png", "image/jpeg"] as const;

export function selectNotebookOutputView(
  data: Record<string, string>
): NotebookRichOutputView | null {
  for (const mime of BASE64_IMAGE_MIMES) {
    const value = data[mime];
    if (typeof value === "string" && value.length > 0) {
      return {
        kind: "image",
        mime,
        src: `data:${mime};base64,${value.replace(/\n/g, "")}`,
      };
    }
  }

  const svg = data["image/svg+xml"];
  if (typeof svg === "string" && svg.length > 0) {
    return {
      kind: "image",
      mime: "image/svg+xml",
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    };
  }

  const html = data["text/html"];
  if (typeof html === "string" && html.length > 0) {
    return { kind: "html", html };
  }

  const latex = data["text/latex"];
  if (typeof latex === "string" && latex.length > 0) {
    return { kind: "latex", source: latex };
  }

  const markdown = data["text/markdown"];
  if (typeof markdown === "string" && markdown.length > 0) {
    return { kind: "markdown", source: markdown };
  }

  const text = data["text/plain"];
  if (typeof text === "string" && text.length > 0) {
    return { kind: "text", text };
  }

  return null;
}

// sympy e afins delimitam com $...$; latex cru (sem delimitador) vira bloco
// de math pro remark-math renderizar via katex.
export function latexToMarkdown(source: string): string {
  const trimmed = source.trim();
  if (trimmed.includes("$")) return trimmed;
  return `$$\n${trimmed}\n$$`;
}
