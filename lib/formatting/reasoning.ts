const GLUED_HEADING_RE = /([^\n])([ \t]*#{1,3}\s+)/g;
const SINGLE_BREAK_HEADING_RE = /([^\n])\n(#{1,3}\s+)/g;
const GLUED_BOLD_HEADING_RE =
  /([.!?:])([ \t]*\*\*[A-ZÀ-Ý0-9][^*\n]{2,120}\*\*)(?=(?:\s|$))/g;
const SINGLE_BREAK_BOLD_HEADING_RE =
  /([^\n])\n(\*\*[A-ZÀ-Ý0-9][^*\n]{2,120}\*\*)(?=(?:\s|$))/g;

export function normalizeReasoningMarkdown(content: string): string {
  if (!content) return "";

  const normalized = content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(GLUED_HEADING_RE, "$1\n\n$2")
    .replace(SINGLE_BREAK_HEADING_RE, "$1\n\n$2")
    .replace(GLUED_BOLD_HEADING_RE, "$1\n\n$2")
    .replace(SINGLE_BREAK_BOLD_HEADING_RE, "$1\n\n$2")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}
