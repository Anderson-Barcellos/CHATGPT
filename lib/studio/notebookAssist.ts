const FENCE_PATTERN = /```(?:python|py)?[^\S\n]*\n([\s\S]*?)```/;

// A resposta do modo célula deve ser um único bloco ```python; se vier texto
// solto (modelo fora do contrato), o texto aparado ainda serve de proposta.
export function extractPythonCodeBlock(markdown: string): string {
  const match = FENCE_PATTERN.exec(markdown);
  const code = match?.[1]?.trim();
  if (code) return code;
  return markdown.trim();
}
