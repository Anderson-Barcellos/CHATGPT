import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import {
  createChatMarkdownComponents,
  chatMarkdownRemarkPlugins,
} from "@/components/chat/chatMarkdownRenderer";

const MERMAID_SOURCE = `\`\`\`mermaid
flowchart LR
  A[Pedido] --> B[Resposta]
\`\`\``;

function renderMarkdown(renderMermaid: boolean) {
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={chatMarkdownRemarkPlugins}
      components={createChatMarkdownComponents({ renderMermaid })}
    >
      {MERMAID_SOURCE}
    </ReactMarkdown>
  );
}

describe("chat markdown Mermaid routing", () => {
  it("routes a completed Mermaid fence to the diagram renderer", () => {
    const markup = renderMarkdown(true);

    expect(markup).toContain('data-mermaid-diagram="true"');
    expect(markup).toContain("Preparando diagrama");
  });

  it("keeps Mermaid as a regular code block while live rendering is active", () => {
    const markup = renderMarkdown(false);

    expect(markup).not.toContain('data-mermaid-diagram="true"');
    expect(markup).toContain(">mermaid</span>");
    expect(markup).toContain("flowchart");
    expect(markup).toContain("Pedido");
  });
});
