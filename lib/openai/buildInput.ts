import { Message } from "@/types";

export function buildInputFromMessages(messages: Message[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}
