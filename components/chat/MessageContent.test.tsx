import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageContent } from "@/components/chat/MessageContent";

vi.mock("@/hooks/useArtifactSessionPersistence", () => ({
  useArtifactSessionPersistence: () => async () => undefined,
}));

describe("MessageContent streaming markdown", () => {
  it("renders assistant streaming responses as markdown with a live cursor", () => {
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

    expect(markup).toContain("<h1");
    expect(markup).toContain("Titulo");
    expect(markup).toContain("<li");
    expect(markup).toContain("item em stream");
    expect(markup).toContain('data-streaming-cursor="true"');
  });
});
