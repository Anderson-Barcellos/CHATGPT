import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_THRESHOLD,
  deriveScrollState,
  getDistanceFromBottom,
  shouldAutoScroll,
} from "@/lib/chat/scrollState";

describe("scroll state helpers", () => {
  it("derives reading-history when the user is away from the bottom", () => {
    const distance = getDistanceFromBottom({
      scrollHeight: 1000,
      scrollTop: 400,
      clientHeight: 300,
    });

    const snapshot = deriveScrollState({
      distanceFromBottom: distance,
      hasMessages: true,
      isTrackingBottom: false,
      initialLoadComplete: true,
    });

    expect(snapshot.distanceFromBottom).toBe(300);
    expect(snapshot.isNearBottom).toBe(false);
    expect(snapshot.mode).toBe("reading-history");
    expect(snapshot.shouldShowScrollButton).toBe(true);
  });

  it("allows autoscroll on initial load or when already near the bottom", () => {
    expect(
      shouldAutoScroll({
        initialLoadComplete: false,
        isTrackingBottom: false,
        isNearBottom: false,
      })
    ).toBe(true);

    expect(
      shouldAutoScroll({
        initialLoadComplete: true,
        isTrackingBottom: false,
        isNearBottom: true,
      })
    ).toBe(true);

    expect(AUTO_SCROLL_THRESHOLD).toBeGreaterThan(0);
  });
});
