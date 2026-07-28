export function composeSpeechTranscriptPreview(
  base: string,
  transcriptPreview: string
): string {
  if (!base.trim()) return transcriptPreview;
  return `${base}${base.endsWith("\n") ? "" : "\n"}${transcriptPreview}`;
}
