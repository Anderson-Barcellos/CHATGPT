import { Message } from "@/types";

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

type InputMessage =
  | { role: string; content: string }
  | { role: string; content: ContentPart[] };

/**
 * Verifica se dataUrl e um base64 de imagem valido (nao thumbnail miniatura).
 *
 * Evita dois problemas:
 * 1. Anexos persistidos que perderam dataUrl durante sanitizacao (dataUrl=undefined)
 * 2. Imagens muito pequenas onde resize e thumbnail produzem bases identicos
 *
 * Exige pelo menos 100 chars base64 pra distinguir thumbnail (~200px) de imagem real.
 */
function isValidImageDataUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]{100,}$/.test(url);
}

/**
 * Detecta placeholder de texto extraido que sobrou de sanitizacao de armazenamento.
 * Ex: "[12345 chars]" — nao deve ser enviado ao modelo.
 */
function isSanitizedPlaceholder(text: string | undefined): boolean {
  return Boolean(text && /^\[\d+ chars\]$/.test(text.trim()));
}

export function buildInputFromMessages(messages: Message[]): InputMessage[] {
  return messages.map((message) => {
    // Imagens: so inclui se dataUrl for uma imagem base64 real (nao thumbnail)
    const imageAttachments = message.attachments?.filter(
      (a) => a.type === "image" && isValidImageDataUrl(a.dataUrl)
    ) ?? [];

    // Texto/PDF: so inclui se extractedText nao for placeholder de sanitizacao
    const textAttachments = message.attachments?.filter(
      (a) =>
        a.type !== "image" &&
        a.extractedText &&
        !isSanitizedPlaceholder(a.extractedText)
    ) ?? [];

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
