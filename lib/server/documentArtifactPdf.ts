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

const A4_PDF_CSS = `
  @page {
    size: A4;
    margin: 14mm 16mm 18mm;
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
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.58;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .document-page {
    width: 100%;
    margin: 0 auto;
  }

  .document-header {
    position: relative;
    margin-bottom: 22pt;
    padding: 14pt 16pt 16pt;
    border: 1px solid #dbe3ef;
    border-radius: 16pt;
    background:
      linear-gradient(135deg, rgba(15, 23, 42, 0.04), rgba(226, 232, 240, 0.18)),
      #ffffff;
    overflow: hidden;
  }

  .document-header::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 4pt;
    background: linear-gradient(90deg, #0f172a, #64748b 46%, #cbd5e1);
  }

  .document-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12pt;
    margin-bottom: 14pt;
    font-family: Arial, Helvetica, sans-serif;
  }

  .document-brand-left {
    display: flex;
    align-items: center;
    gap: 7pt;
    min-width: 0;
  }

  .document-brand-mark {
    display: inline-flex;
    width: 20pt;
    height: 20pt;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #0f172a;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .document-brand-name {
    color: #0f172a;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .document-brand-kind {
    color: #64748b;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .document-eyebrow {
    margin: 0 0 5pt;
    color: #64748b;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .document-title {
    margin: 0;
    color: #020617;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22pt;
    line-height: 1.14;
  }

  .document-summary {
    max-width: 150mm;
    margin: 9pt 0 0;
    color: #475569;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
  }

  .document-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8pt;
    margin-top: 14pt;
    font-family: Arial, Helvetica, sans-serif;
  }

  .document-meta-item {
    padding: 7pt 8pt;
    border: 1px solid #e2e8f0;
    border-radius: 9pt;
    background: rgba(248, 250, 252, 0.82);
  }

  .document-meta-label {
    margin: 0 0 2pt;
    color: #64748b;
    font-size: 7.2pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .document-meta-value {
    margin: 0;
    color: #1e293b;
    font-size: 8.6pt;
    font-weight: 650;
  }

  .document-body {
    padding: 0 1pt;
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
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.22;
  }

  h1 { margin: 20pt 0 8pt; font-size: 20pt; }
  h2 { margin: 18pt 0 7pt; font-size: 16pt; }
  h3 { margin: 14pt 0 6pt; font-size: 13.5pt; }
  h4, h5, h6 { margin: 12pt 0 5pt; font-size: 11.5pt; }

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
  }

  table {
    width: 100%;
    border-collapse: collapse;
    break-inside: auto;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9pt;
    border: 1px solid #cbd5e1;
    border-radius: 8pt;
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
  }

  a {
    color: #1d4ed8;
    text-decoration: underline;
  }

  .document-body a[href^="http"]::after {
    content: " (" attr(href) ")";
    color: #64748b;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    overflow-wrap: anywhere;
  }

  .footnotes,
  section.footnotes {
    margin-top: 22pt;
    padding-top: 10pt;
    border-top: 1px solid #cbd5e1;
    color: #475569;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt;
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

function formatExportedAt(date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
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
  const summary = artifact.summary ? escapeHtml(artifact.summary) : "";
  const exportedAt = escapeHtml(formatExportedAt());

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
        <div class="document-brand">
          <div class="document-brand-left">
            <span class="document-brand-mark">GC</span>
            <span class="document-brand-name">Gaucho Chat</span>
          </div>
          <span class="document-brand-kind">Documento A4 exportável</span>
        </div>
        <p class="document-eyebrow">Documento</p>
        <h1 class="document-title">${title}</h1>
        ${summary ? `<p class="document-summary">${summary}</p>` : ""}
        <div class="document-meta-grid">
          <div class="document-meta-item">
            <p class="document-meta-label">Exportado em</p>
            <p class="document-meta-value">${exportedAt}</p>
          </div>
          <div class="document-meta-item">
            <p class="document-meta-label">Formato</p>
            <p class="document-meta-value">PDF A4</p>
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
        padding: 0 16mm;
        color: #64748b;
        font-family: Arial, Helvetica, sans-serif;
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
        max-width: 130mm;
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
        top: "14mm",
        right: "16mm",
        bottom: "18mm",
        left: "16mm",
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
