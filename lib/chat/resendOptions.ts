import type { Message, SendMessageOptions } from "@/types";

export function buildEditResendOptions(
  originalMessage: Message | undefined
): SendMessageOptions {
  if (!originalMessage) return {};

  return {
    ...(originalMessage.responseMode && {
      responseMode: originalMessage.responseMode,
    }),
    ...(originalMessage.attachments && {
      attachments: originalMessage.attachments,
    }),
  };
}
