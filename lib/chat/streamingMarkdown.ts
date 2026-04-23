import type { MessageStreamStatus } from "@/types";

export function shouldShowStreamingMarkdownCursor(
  streamStatus: MessageStreamStatus | undefined,
  isSettlingCursorVisible: boolean
): boolean {
  if (streamStatus === "streaming") return true;
  return isSettlingCursorVisible;
}
