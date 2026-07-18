export type TranscriptionStreamMessage =
  | { type: "delta"; delta: string }
  | { type: "done"; text: string }
  | { type: "error"; error: string };

export function parseTranscriptionStreamLine(
  line: string
): TranscriptionStreamMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error("Evento de transcricao invalido.");
  }

  if (parsed.type === "delta" && "delta" in parsed && typeof parsed.delta === "string") {
    return { type: "delta", delta: parsed.delta };
  }
  if (parsed.type === "done" && "text" in parsed && typeof parsed.text === "string") {
    return { type: "done", text: parsed.text };
  }
  if (parsed.type === "error" && "error" in parsed && typeof parsed.error === "string") {
    return { type: "error", error: parsed.error };
  }

  throw new Error("Evento de transcricao invalido.");
}
