import { describe, expect, it } from "vitest";
import { getWebSearchIndicatorStatus, MessageBubble } from "./MessageBubble";

describe("MessageBubble rendering", () => {
  it("memoizes stable history while the newest response streams", () => {
    expect(MessageBubble).toHaveProperty("$$typeof", Symbol.for("react.memo"));
  });
});

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
