const MAX_TITLE_LENGTH = 110;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdown(value: string): string {
  return compactWhitespace(
    value
      .replace(/!\[[^\]]*]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/[*_~`>]+/g, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
  );
}

function firstSentence(value: string): string {
  const match = value.match(/^(.{24,}?[.!?])\s+/);
  return match?.[1] ?? value;
}

function truncateTitle(value: string): string {
  if (value.length <= MAX_TITLE_LENGTH) return value;
  const clipped = value.slice(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, "");
  return `${clipped || value.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

export function derivePulseRunTitle(content: string, fallbackTitle: string): string {
  const fallback = fallbackTitle.trim() || "Pulse";
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const heading = lines.find((line) => /^#{1,3}\s+\S/.test(line));
  if (heading) {
    return truncateTitle(stripMarkdown(heading.replace(/^#{1,3}\s+/, "")) || fallback);
  }

  const firstMeaningfulLine = lines.find(
    (line) => !line.startsWith("![") && !/^[-*_]{3,}$/.test(line)
  );
  if (!firstMeaningfulLine) return fallback;

  const cleaned = stripMarkdown(firstMeaningfulLine);
  return truncateTitle(firstSentence(cleaned) || fallback);
}
