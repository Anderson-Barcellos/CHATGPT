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

describe("títulos do markdown acompanham a régua do corpo", () => {
  it("usa tamanhos relativos ao corpo (em), iguais aos de hoje com corpo de 14 px", () => {
    const markup = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={chatMarkdownRemarkPlugins}
        components={createChatMarkdownComponents({ renderMermaid: false })}
      >
        {"# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6"}
      </ReactMarkdown>
    );
    const sizeOf = (tag: string) => markup.match(new RegExp(`<${tag} class="[^"]*(text-\\S+em\\])`))?.[1];

    expect(sizeOf("h1")).toBe("text-[1.2857em]");
    expect(sizeOf("h2")).toBe("text-[1.2857em]");
    expect(sizeOf("h3")).toBe("text-[1.1429em]");
    expect(sizeOf("h4")).toBe("text-[1em]");
    expect(sizeOf("h5")).toBe("text-[1em]");
    expect(sizeOf("h6")).toBe("text-[0.8571em]");
    expect(markup).not.toMatch(/<h[1-6] class="[^"]*text-(?:xs|sm|base|lg)\b/);
  });
});
