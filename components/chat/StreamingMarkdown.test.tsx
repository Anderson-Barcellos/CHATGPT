import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StreamingMarkdown } from "./StreamingMarkdown";

describe("StreamingMarkdown", () => {
  it("marca o texto que ainda está chegando, para o CSS não reequilibrar títulos a cada token", () => {
    const streaming = renderToStaticMarkup(<StreamingMarkdown content="## Título em andamento" streamStatus="streaming" />);
    const completed = renderToStaticMarkup(<StreamingMarkdown content="## Título pronto" streamStatus="completed" />);

    expect(streaming).toContain('data-streaming=""');
    expect(completed).not.toContain("data-streaming");
    expect(completed).toContain("Título pronto");
  });
});
