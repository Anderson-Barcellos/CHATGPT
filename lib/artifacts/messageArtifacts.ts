import {
  ArtifactContentType,
  DocumentMessageArtifact,
  MessageArtifactDisplayMode,
  UrlCitation,
} from "@/types";

const FULL_HTML_ARTIFACT_RE = /<(html|body|script|style|svg|canvas|iframe)\b/i;
const RAW_HTML_RE = /<(table|thead|tbody|tr|td|th|details|summary)\b/i;
const HEADING_RE = /^#{1,3}\s+(.+)$/gm;
const CODE_FENCE_RE = /```/g;
const BULLET_RE = /^\s*(?:[-*+]|\d+\.)\s+/gm;
const TABLE_RE = /(^|\n)\|.+\|(\n|$)/;
const TABLE_DIVIDER_RE = /(^|\n)\|?(?:\s*:?-{3,}:?\s*\|){2,}/;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(new RegExp(pattern.source, pattern.flags))?.length ?? 0;
}

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const slice = text.slice(0, maxLength);
  const boundary = slice.search(/[.!?]\s[^.!?]*$/);
  if (boundary > 0) {
    return `${slice.slice(0, boundary + 1).trim()}`;
  }

  return `${slice.trimEnd()}...`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitBlocks(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function isNarrativeBlock(block: string): boolean {
  if (!block) return false;
  if (block.startsWith("```")) return false;
  if (/^#{1,6}\s+/.test(block)) return false;
  if (/^\|/.test(block)) return false;
  if (/^\s*(?:[-*+]|\d+\.)\s+/.test(block)) return false;

  return stripMarkdown(block).length >= 40;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCitationHostnameVariants(citation: UrlCitation): string[] {
  try {
    const hostname = new URL(citation.url).hostname.toLowerCase();
    if (!hostname) return [];

    const withoutWww = hostname.replace(/^www\./, "");
    return Array.from(new Set([hostname, withoutWww])).filter(Boolean);
  } catch {
    return [];
  }
}

function toCitationHostKey(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

function buildCitationHostIndexMap(citations: UrlCitation[]): Map<string, number[]> {
  const map = new Map<string, number[]>();

  citations.forEach((citation, index) => {
    for (const hostname of buildCitationHostnameVariants(citation)) {
      const key = toCitationHostKey(hostname);
      const current = map.get(key) ?? [];
      current.push(index + 1);
      map.set(key, current);
    }
  });

  return map;
}

function resolveInlineCitationIndex(
  hostMatch: string | undefined,
  citationsByHost: Map<string, number[]>,
  hostUsageCount: Map<string, number>
): number | undefined {
  if (!hostMatch) return undefined;

  const key = toCitationHostKey(hostMatch);
  const indices = citationsByHost.get(key);
  if (!indices || indices.length === 0) return undefined;

  const used = hostUsageCount.get(key) ?? 0;
  const nextIndex = indices[Math.min(used, indices.length - 1)];
  hostUsageCount.set(key, used + 1);
  return nextIndex;
}

function formatInlineCitationMarker(index: number, leadingSpace = true): string {
  return `${leadingSpace ? " " : ""}[${index}]`;
}

function replaceInlineCitationSourcesWithIndices(
  text: string,
  citations: UrlCitation[]
): string {
  const citationsByHost = buildCitationHostIndexMap(citations);
  const hostnames = Array.from(citationsByHost.keys()).filter(Boolean);

  if (hostnames.length === 0) {
    return text;
  }

  const hostPattern = hostnames.map(escapeRegExp).join("|");
  const citationTarget =
    String.raw`(?:https?:\/\/)?(?:www\.)?(${hostPattern})(?:\/[^\s)\]]*)?`;
  const citationPayload =
    String.raw`(?:(?:fonte|source|refer[eê]ncia)\s*:\s*)?${citationTarget}`;
  const hostUsageCount = new Map<string, number>();

  return text
    .replace(
      new RegExp(String.raw`[ \t]*\((?:${citationPayload})\)`, "gi"),
      (_match, host: string) => {
        const index = resolveInlineCitationIndex(
          host,
          citationsByHost,
          hostUsageCount
        );
        return index ? formatInlineCitationMarker(index) : "";
      }
    )
    .replace(
      new RegExp(String.raw`[ \t]*\[(?:${citationPayload})\]`, "gi"),
      (_match, host: string) => {
        const index = resolveInlineCitationIndex(
          host,
          citationsByHost,
          hostUsageCount
        );
        return index ? formatInlineCitationMarker(index) : "";
      }
    )
    .replace(
      new RegExp(
        String.raw`(^|\n)[ \t]*(?:${citationPayload})[ \t]*(?=\n|$)`,
        "gim"
      ),
      (match, prefix: string, host: string) => {
        const index = resolveInlineCitationIndex(
          host,
          citationsByHost,
          hostUsageCount
        );
        if (!index) return prefix;
        return `${prefix}${formatInlineCitationMarker(index, prefix !== "")}`;
      }
    );
}

function collapseAdjacentDuplicateCitationMarkers(text: string): string {
  return text.replace(/(\[\d+\])(?:[ \t]*\1)+/g, "$1");
}

export function cleanCitationMarkers(
  text: string,
  citations: UrlCitation[] = []
): string {
  const cleaned = text
    .replace(/【(\d+)(?::\d+)?†[^】]*】/g, "[$1]")
    .replace(/[ \t]*\(\s*(\[\d+\])\s*\)(?=\s|[.,;:!?]|\n|$)/g, " $1")
    .replace(/[ \t]*\[\s*(\[\d+\])\s*\](?=\s|[.,;:!?]|\n|$)/g, " $1")
    .replace(/[ \t]*\(\s*(?:\[\s*\])?\s*\)(?=\s|[.,;:!?]|\n|$)/g, "")
    .replace(/[ \t]*\(\s*\)(?=\s|[.,;:!?]|\n|$)/g, "")
    .replace(/[ \t]*\[\s*\](?=\s|[.,;:!?]|\n|$)/g, "");

  const indexed = collapseAdjacentDuplicateCitationMarkers(
    replaceInlineCitationSourcesWithIndices(cleaned, citations)
  );

  return collapseAdjacentDuplicateCitationMarkers(
    indexed.replace(/\n[ \t]*(\[\d+\])(?=\n|$)/g, " $1")
  )
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/(?:\n\s*)+$/g, "");
}

export function detectArtifactContentType(content: string): ArtifactContentType {
  if (FULL_HTML_ARTIFACT_RE.test(content.trim())) {
    return "html";
  }

  return "markdown";
}

export function detectRichContent(content: string): {
  isRich: boolean;
  type: ArtifactContentType;
} {
  const normalized = cleanCitationMarkers(content).trim();
  const type = detectArtifactContentType(normalized);
  const codeBlockCount = Math.floor(countMatches(normalized, CODE_FENCE_RE) / 2);
  const hasComplexMarkdown =
    normalized.includes("```mermaid") ||
    normalized.includes("```html") ||
    normalized.includes("```svg") ||
    RAW_HTML_RE.test(normalized) ||
    (TABLE_RE.test(normalized) && TABLE_DIVIDER_RE.test(normalized)) ||
    codeBlockCount >= 2;
  const hasDocumentMarkers =
    normalized.includes("# ") &&
    normalized.includes("## ") &&
    (normalized.includes("### ") || normalized.includes("- [ ]"));

  if (type === "html") {
    return { isRich: true, type };
  }

  if (hasComplexMarkdown || hasDocumentMarkers) {
    return { isRich: true, type };
  }

  return { isRich: false, type };
}

function shouldCreateArtifact(content: string): boolean {
  const normalized = cleanCitationMarkers(content).trim();
  if (!normalized) return false;
  if (/^(?:⏹️|❌)\s/.test(normalized)) return false;

  const plainText = stripMarkdown(normalized);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const blocks = splitBlocks(normalized);
  const paragraphCount = blocks.filter(isNarrativeBlock).length;
  const headingCount = countMatches(normalized, HEADING_RE);
  const codeBlockCount = Math.floor(countMatches(normalized, CODE_FENCE_RE) / 2);
  const listCount = countMatches(normalized, BULLET_RE);
  const hasTable =
    RAW_HTML_RE.test(normalized) ||
    (TABLE_RE.test(normalized) && TABLE_DIVIDER_RE.test(normalized));
  const isHtmlArtifact = detectArtifactContentType(normalized) === "html";

  if (wordCount < 120 && !isHtmlArtifact) return false;
  if (!isHtmlArtifact && paragraphCount < 2 && headingCount === 0 && listCount < 4) {
    return false;
  }

  let score = 0;

  if (isHtmlArtifact) score += 4;
  if (headingCount >= 2) score += 3;
  else if (headingCount === 1) score += 1;
  if (paragraphCount >= 3) score += 2;
  if (paragraphCount >= 6) score += 1;
  if (listCount >= 3) score += 1;
  if (codeBlockCount >= 2) score += 2;
  if (hasTable) score += 2;
  if (wordCount >= 180) score += 1;
  if (wordCount >= 320) score += 2;
  if (wordCount >= 600) score += 2;

  return score >= 5 || (wordCount >= 700 && paragraphCount >= 2);
}

function inferArtifactTitle(content: string): string {
  const headingMatch = HEADING_RE.exec(content);
  HEADING_RE.lastIndex = 0;
  if (headingMatch?.[1]) {
    return clampText(stripMarkdown(headingMatch[1]), 72);
  }

  const firstMeaningfulLine = content
    .split("\n")
    .map((line) => stripMarkdown(line))
    .find((line) => line.length >= 8);

  if (firstMeaningfulLine) {
    return clampText(firstMeaningfulLine, 72);
  }

  return "Documento gerado";
}

function inferArtifactSummary(content: string): string {
  const blocks = splitBlocks(content);
  const firstNarrativeBlock = blocks.find(isNarrativeBlock);
  const candidate = stripMarkdown(firstNarrativeBlock ?? content);

  if (!candidate) {
    return "Documento gerado automaticamente a partir da resposta do assistente.";
  }

  return clampText(candidate, 220);
}

interface CreateMessageArtifactOptions {
  force?: boolean;
  displayMode?: MessageArtifactDisplayMode;
  citations?: UrlCitation[];
}

export function createMessageArtifact(
  content: string,
  options: CreateMessageArtifactOptions = {}
): DocumentMessageArtifact | undefined {
  if (!options.force && !shouldCreateArtifact(content)) {
    return undefined;
  }

  const cleanedContent = cleanCitationMarkers(
    content,
    options.citations
  ).trim();
  if (!cleanedContent) return undefined;

  return {
    id: crypto.randomUUID(),
    kind: "document",
    title: inferArtifactTitle(cleanedContent),
    summary: inferArtifactSummary(cleanedContent),
    content: cleanedContent,
    type: detectArtifactContentType(cleanedContent),
    displayMode: options.displayMode || "default",
  };
}
