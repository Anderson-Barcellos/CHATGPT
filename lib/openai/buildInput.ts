import { Message } from "@/types";

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type InputMessage =
  | { role: string; content: string }
  | { role: string; content: ContentPart[] };

export function buildInputFromMessages(messages: Message[]): InputMessage[] {
  return messages.map((message) => {
    const imageAttachments = message.attachments?.filter((a) => a.type === "image" && a.dataUrl) ?? [];
    const textAttachments = message.attachments?.filter((a) => a.type !== "image" && a.extractedText) ?? [];

    let textContent = message.content;
    if (textAttachments.length > 0) {
      const extracted = textAttachments
        .map((a) => `[Arquivo: ${a.name}]\n${a.extractedText}`)
        .join("\n\n---\n\n");
      textContent = textContent.trim()
        ? `${textContent}\n\n${extracted}`
        : extracted;
    }

    if (imageAttachments.length > 0) {
      const parts: ContentPart[] = [
        { type: "input_text", text: textContent || "Analise:" },
        ...imageAttachments.map((img) => ({
          type: "input_image" as const,
          image_url: img.dataUrl!,
        })),
      ];
      return { role: message.role, content: parts };
    }

    return { role: message.role, content: textContent };
  });
}
