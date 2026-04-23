export type ChatViewportMode = "initial" | "tracking" | "reading-history";

export interface ScrollStateSnapshot {
  distanceFromBottom: number;
  isNearBottom: boolean;
  shouldShowScrollButton: boolean;
  mode: ChatViewportMode;
}

export const AUTO_SCROLL_THRESHOLD = 80;
export const SCROLL_BUTTON_THRESHOLD = 120;

export function getDistanceFromBottom(container: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

export function deriveScrollState(options: {
  distanceFromBottom: number;
  hasMessages: boolean;
  isTrackingBottom: boolean;
  initialLoadComplete: boolean;
}) : ScrollStateSnapshot {
  const isNearBottom = options.distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  const shouldShowScrollButton =
    options.hasMessages && options.distanceFromBottom > SCROLL_BUTTON_THRESHOLD;

  let mode: ChatViewportMode = "initial";

  if (options.initialLoadComplete) {
    mode = options.isTrackingBottom || isNearBottom ? "tracking" : "reading-history";
  }

  return {
    distanceFromBottom: options.distanceFromBottom,
    isNearBottom,
    shouldShowScrollButton,
    mode,
  };
}

export function shouldAutoScroll(options: {
  initialLoadComplete: boolean;
  isTrackingBottom: boolean;
  isNearBottom: boolean;
  force?: boolean;
}) {
  if (options.force) return true;
  if (!options.initialLoadComplete) return true;
  return options.isTrackingBottom || options.isNearBottom;
}
