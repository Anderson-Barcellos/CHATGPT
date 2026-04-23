import { describe, expect, it } from "vitest";
import { shouldShowStreamingMarkdownCursor } from "@/lib/chat/streamingMarkdown";

describe("streaming markdown cursor", () => {
  it("keeps the cursor visible while the response is still streaming", () => {
    expect(shouldShowStreamingMarkdownCursor("streaming", false)).toBe(true);
  });

  it("keeps the cursor visible for a short settling window after streaming ends", () => {
    expect(shouldShowStreamingMarkdownCursor("completed", true)).toBe(true);
    expect(shouldShowStreamingMarkdownCursor("completed", false)).toBe(false);
  });
});
