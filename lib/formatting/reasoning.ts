import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";

export function normalizeReasoningMarkdown(content: string): string {
  return normalizeChatMarkdown(content);
}
