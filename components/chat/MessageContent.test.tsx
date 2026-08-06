import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageContent } from "@/components/chat/MessageContent";

vi.mock("@/hooks/useArtifactSessionPersistence", () => ({
  useArtifactSessionPersistence: () => async () => undefined,
}));

describe("MessageContent streaming routing", () => {
  it("wraps assistant streaming messages with the aria-live streaming renderer", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-stream",
          role: "assistant",
          content: "# Titulo\n\n- item em stream",
          timestamp: new Date("2026-04-23T12:00:00.000Z"),
          streamStatus: "streaming",
        }}
      />
    );

    expect(markup).toContain('aria-live="polite"');
  });

  it("renders full markdown for assistant messages that already finished", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-done",
          role: "assistant",
          content: "# Titulo\n\n- item pronto",
          timestamp: new Date("2026-04-23T12:00:00.000Z"),
          streamStatus: "completed",
        }}
      />
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("Titulo");
    expect(markup).toContain("<li");
    expect(markup).toContain("item pronto");
  });

  it("promotes a completed Mermaid fence from live code to the diagram renderer", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-mermaid-done",
          role: "assistant",
          content: "```mermaid\nflowchart LR\n  A --> B\n```",
          timestamp: new Date("2026-08-05T12:00:00.000Z"),
          streamStatus: "completed",
        }}
      />
    );

    expect(markup).toContain('data-mermaid-diagram="true"');
    expect(markup).not.toContain(">mermaid</span>");
  });

  it("does not render panel actions while an artifact is still being prepared", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-document-loading",
          role: "assistant",
          content: "",
          timestamp: new Date("2026-04-23T12:00:00.000Z"),
          streamStatus: "streaming",
          preferredDisplayMode: "document",
        }}
      />
    );

    expect(markup).toContain("Montando o documento");
    expect(markup).not.toContain("Abrir no painel");
  });

  it("renders panel actions once an artifact exists", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-document-ready",
          role: "assistant",
          content: "Documento pronto",
          timestamp: new Date("2026-04-23T12:00:00.000Z"),
          streamStatus: "completed",
          preferredDisplayMode: "document",
          artifact: {
            id: "artifact-1",
            kind: "document",
            title: "Documento pronto",
            summary: "Resumo do documento.",
            displayMode: "document",
            content: "# Documento pronto",
            type: "markdown",
          },
        }}
      />
    );

    expect(markup).toContain("Visualizar A4");
    expect(markup).toContain("Abrir Canvas");
  });

  it("renders an animated placeholder while an image is still being generated", () => {
    const markup = renderToStaticMarkup(
      <MessageContent
        message={{
          id: "assistant-image-loading",
          role: "assistant",
          content: "Cria um logo minimalista com fundo transparente.",
          timestamp: new Date("2026-05-11T12:00:00.000Z"),
          streamStatus: "streaming",
          isGeneratingImage: true,
        }}
      />
    );

    expect(markup).toContain("Gerando imagem");
    expect(markup).toContain("primeiro preview");
    expect(markup).not.toContain("<img");
  });
});
