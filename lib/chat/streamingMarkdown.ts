import type { MessageStreamStatus } from "@/types";

export const STREAMING_MARKDOWN_SETTLE_MS = 420;

export function shouldShowStreamingMarkdownCursor(
  streamStatus: MessageStreamStatus | undefined,
  isSettlingCursorVisible: boolean
): boolean {
  if (streamStatus === "streaming") return true;
  return isSettlingCursorVisible;
}
