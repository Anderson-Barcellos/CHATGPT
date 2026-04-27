import { describe, expect, it } from "vitest";
import { canSubmitComposerMessage } from "@/lib/chat/composerSubmit";

describe("canSubmitComposerMessage", () => {
  it("allows submit when there is content and files are idle", () => {
    expect(
      canSubmitComposerMessage({
        hasContent: true,
        isProcessing: false,
      })
    ).toBe(true);
  });

  it("blocks submit while files are processing", () => {
    expect(
      canSubmitComposerMessage({
        hasContent: true,
        isProcessing: true,
      })
    ).toBe(false);
  });

  it("blocks submit without content", () => {
    expect(
      canSubmitComposerMessage({
        hasContent: false,
        isProcessing: false,
      })
    ).toBe(false);
  });
});
