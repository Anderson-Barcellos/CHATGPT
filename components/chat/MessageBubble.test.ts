import { describe, expect, it } from "vitest";
import { getWebSearchIndicatorStatus } from "./MessageBubble";

describe("getWebSearchIndicatorStatus", () => {
  it("keeps completed web searches visible after the transient state ends", () => {
    expect(
      getWebSearchIndicatorStatus({ isSearching: false, didSearch: true })
    ).toBe("completed");
  });

  it("prioritizes the active searching state", () => {
    expect(
      getWebSearchIndicatorStatus({ isSearching: true, didSearch: true })
    ).toBe("searching");
  });

  it("hides the indicator when no web search occurred", () => {
    expect(
      getWebSearchIndicatorStatus({ isSearching: false, didSearch: false })
    ).toBeNull();
  });
});
