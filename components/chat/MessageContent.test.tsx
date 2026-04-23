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
});
