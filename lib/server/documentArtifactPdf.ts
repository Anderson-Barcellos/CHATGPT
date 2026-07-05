import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import type { DocumentMessageArtifact } from "@/types";
import { normalizeChatMarkdown } from "@/lib/formatting/chatMarkdown";

function readLexendFontDataUrl(weight: 400 | 600 | 700): string | null {
  try {
    const fontPath = join(
      process.cwd(),
      "node_modules",
      "@fontsource",
      "lexend",
      "files",
      `lexend-latin-${weight}-normal.woff2`
    );
    const fontData = readFileSync(fontPath).toString("base64");
    return `data:font/woff2;base64,${fontData}`;
  } catch {
    return null;
  }
}

function buildLexendFontFaceCss(): string {
  return ([400, 600, 700] as const)
    .map((weight) => {
      const dataUrl = readLexendFontDataUrl(weight);
      if (!dataUrl) return "";

      return `
  @font-face {
    font-family: "Lexend";
    font-style: normal;
    font-weight: ${weight};
    font-display: swap;
    src: url("${dataUrl}") format("woff2");
  }`;
    })
    .join("");
}

const OPENAI_TITLE_MARK = `
  <svg class="openai-title-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>`;

const A4_PDF_CSS = `
  ${buildLexendFontFaceCss()}

  @page {
    size: A4;
    margin: 17mm 19mm 20mm;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 10.2pt;
    line-height: 1.66;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .document-page {
    width: 100%;
    margin: 0 auto;
  }

  .document-header {
    margin-bottom: 14pt;
    padding-bottom: 9pt;
    border-bottom: 1px solid #e2e8f0;
  }

  .document-title-lockup {
    display: flex;
    align-items: flex-start;
    gap: 8pt;
  }

  .openai-title-mark {
    width: 16pt;
    height: 16pt;
    flex: 0 0 auto;
    margin-top: 4pt;
    color: #0f172a;
    fill: currentColor;
  }

  .document-title-stack {
    min-width: 0;
  }

  .document-kicker {
    margin: 0 0 2pt;
    color: #64748b;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    line-height: 1;
    text-transform: uppercase;
  }

  .document-title {
    margin: 0;
    color: #020617;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 17.2pt;
    font-weight: 700;
    line-height: 1.16;
  }

  .document-body {
    padding: 0 1pt;
    text-align: justify;
    text-justify: inter-word;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: #0f172a;
    break-after: avoid;
    page-break-after: avoid;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-weight: 700;
    line-height: 1.22;
  }

  h1 { margin: 18pt 0 7pt; font-size: 17.2pt; }
  h2 { margin: 16pt 0 6pt; font-size: 14.2pt; }
  h3 { margin: 13pt 0 5pt; font-size: 12.4pt; }
  h4, h5, h6 { margin: 11pt 0 5pt; font-size: 10.8pt; }

  p,
  ul,
  ol,
  blockquote,
  table,
  pre {
    margin-top: 0;
    margin-bottom: 9pt;
  }

  ul,
  ol {
    padding-left: 18pt;
  }

  li {
    margin-bottom: 3pt;
  }

  blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-left: 0;
    padding: 9pt 12pt;
    border: 1px solid #dbeafe;
    border-left: 4pt solid #64748b;
    border-radius: 8pt;
    background: linear-gradient(90deg, rgba(241, 245, 249, 0.96), rgba(248, 250, 252, 0.72));
    color: #334155;
    text-align: left;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    break-inside: auto;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 9pt;
    border: 1px solid #cbd5e1;
    border-radius: 8pt;
    text-align: left;
  }

  thead {
    display: table-header-group;
  }

  tr,
  img,
  pre,
  blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  th,
  td {
    padding: 6pt 7pt;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }

  th {
    background: #e2e8f0;
    font-weight: 700;
    text-align: left;
  }

  tbody tr:nth-child(even) td {
    background: #f8fafc;
  }

  code,
  pre {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 8.5pt;
  }

  code {
    padding: 1pt 3pt;
    border-radius: 3pt;
    background: #f1f5f9;
  }

  pre {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    padding: 9pt;
    border: 1px solid #e2e8f0;
    border-radius: 6pt;
    background: #f8fafc;
    text-align: left;
  }

  a {
    color: #1d4ed8;
    text-decoration: underline;
  }

  .document-body a[href^="http"]::after {
    content: " (" attr(href) ")";
    color: #64748b;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 8pt;
    overflow-wrap: anywhere;
  }

  .footnotes,
  section.footnotes {
    margin-top: 22pt;
    padding-top: 10pt;
    border-top: 1px solid #cbd5e1;
    color: #475569;
    font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
    font-size: 8.5pt;
    text-align: left;
  }

  img {
    max-width: 100%;
    height: auto;
  }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripUnsafeHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
}

function extractBodyHtml(rawHtml: string): { headStyles: string; bodyHtml: string } {
  const safeHtml = stripUnsafeHtml(rawHtml);
  const headStyles = Array.from(safeHtml.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi))
    .map((match) => match[0])
    .join("\n");
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(safeHtml);

  if (bodyMatch?.[1]) {
    return { headStyles, bodyHtml: bodyMatch[1] };
  }

  return {
    headStyles,
    bodyHtml: safeHtml
      .replace(/<!doctype[\s\S]*?>/gi, "")
      .replace(/<html\b[^>]*>|<\/html>/gi, "")
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ""),
  };
}

function renderMarkdownHtml(markdown: string): string {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkBreaks)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(normalizeChatMarkdown(markdown))
    .toString();
}

function renderArtifactBody(artifact: DocumentMessageArtifact): {
  bodyHtml: string;
  headStyles: string;
} {
  if (artifact.type === "html") {
    return extractBodyHtml(artifact.content);
  }

  return {
    headStyles: "",
    bodyHtml: renderMarkdownHtml(artifact.content),
  };
}

export function buildDocumentArtifactPdfHtml(
  artifact: DocumentMessageArtifact
): string {
  const { bodyHtml, headStyles } = renderArtifactBody(artifact);
  const title = escapeHtml(artifact.title || "Documento");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>${A4_PDF_CSS}</style>
    ${headStyles}
  </head>
  <body>
    <article class="document-page">
      <header class="document-header">
        <div class="document-title-lockup">
          ${OPENAI_TITLE_MARK}
          <div class="document-title-stack">
            <p class="document-kicker">Documento</p>
            <h1 class="document-title">${title}</h1>
          </div>
        </div>
      </header>
      <main class="document-body">${bodyHtml}</main>
    </article>
  </body>
</html>`;
}

function buildFooterTemplate(title: string): string {
  const safeTitle = escapeHtml(title || "Documento");

  return `
    <style>
      .pdf-footer {
        width: 100%;
        padding: 0 19mm;
        color: #64748b;
        font-family: "Lexend", "Inter", "Segoe UI", Arial, sans-serif;
        font-size: 7.5pt;
      }

      .pdf-footer-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid #e2e8f0;
        padding-top: 5pt;
      }

      .pdf-footer-title {
        max-width: 124mm;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>
    <div class="pdf-footer">
      <div class="pdf-footer-line">
        <span class="pdf-footer-title">${safeTitle}</span>
        <span>Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>
    </div>`;
}

function getChromeExecutablePath(): string | undefined {
  return (
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    "/usr/bin/google-chrome-stable"
  );
}

export async function renderDocumentArtifactPdf(
  artifact: DocumentMessageArtifact
): Promise<ArrayBuffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    executablePath: getChromeExecutablePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 794, height: 1123 },
    });

    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith("data:") || requestUrl.startsWith("about:")) {
        await route.continue();
        return;
      }
      await route.abort();
    });

    await page.setContent(buildDocumentArtifactPdfHtml(artifact), {
      waitUntil: "load",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: buildFooterTemplate(artifact.title),
      margin: {
        top: "17mm",
        right: "19mm",
        bottom: "20mm",
        left: "19mm",
      },
    });

    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}
