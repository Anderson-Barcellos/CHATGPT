import { cleanCitationMarkers } from "@/lib/artifacts/messageArtifacts";

const GLUED_HEADING_RE = /([^\n#])([ \t]*#{1,3}\s+)/g;
const SINGLE_BREAK_HEADING_RE = /([^\n])\n(#{1,3}\s+)/g;
const GLUED_BOLD_HEADING_RE =
  /([.!?:])([ \t]*\*\*[A-ZÀ-Ý0-9][^*\n]{2,120}\*\*)(?=(?:\s|$))/g;
const SINGLE_BREAK_BOLD_HEADING_RE =
  /([^\n])\n(\*\*[A-ZÀ-Ý0-9][^*\n]{2,120}\*\*)(?=(?:\s|$))/g;

function normalizeMarkdownSegment(content: string): string {
  return content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\/n(?=\s*[-*#>\d]|[A-ZÀ-Ý(])/g, "\n")
    .replace(GLUED_HEADING_RE, "$1\n\n$2")
    .replace(SINGLE_BREAK_HEADING_RE, "$1\n\n$2")
    .replace(GLUED_BOLD_HEADING_RE, "$1\n\n$2")
    .replace(SINGLE_BREAK_BOLD_HEADING_RE, "$1\n\n$2")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n");
}

export function normalizeChatMarkdown(content: string): string {
  if (!content) return "";

  const withoutCitations = cleanCitationMarkers(content);
  const segments = withoutCitations.split(/(```[\s\S]*?```)/g);
  const normalized = segments
    .map((segment) =>
      segment.startsWith("```") ? segment : normalizeMarkdownSegment(segment)
    )
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}
