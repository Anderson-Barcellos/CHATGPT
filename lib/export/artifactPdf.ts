import { ArtifactContentType } from "@/types";
import { cleanCitationMarkers } from "@/lib/artifacts/messageArtifacts";

interface ArtifactPDFOptions {
  title?: string;
  contentType?: ArtifactContentType;
  filename?: string;
}

function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase()
      .slice(0, 90) || "documento"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeMarkdownForExport(md: string): string {
  return md
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToHtml(md: string): string {
  let html = normalizeMarkdownForExport(md);

  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="code-block"><code>${escapeHtml(code.trimEnd())}</code></pre>`
    );
    return `\n%%CODEBLOCK_${idx}%%\n`;
  });

  html = html.replace(/`([^`]+)`/g, (_, inlineCode: string) => {
    return `<code class="inline-code">${escapeHtml(inlineCode)}</code>`;
  });

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<![*\\])\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");

  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" />'
  );
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  html = html.replace(
    /(?:^|\n)((?:> .+(?:\n|$))+)/g,
    (_: string, quoteBlock: string) => {
      const paragraphs = quoteBlock
        .trim()
        .split("\n")
        .map((line: string) => line.replace(/^>\s?/, "").trim())
        .filter(Boolean)
        .map((line: string) => `<p>${line}</p>`)
        .join("");
      return `\n<blockquote>${paragraphs}</blockquote>\n`;
    }
  );

  html = html.replace(
    /(?:^|\n)((?:\|.+\|\n?)+)/g,
    (_: string, tableBlock: string) => {
      const rows = tableBlock.trim().split("\n");
      if (rows.length < 2) return tableBlock;

      let tableHtml = "\n<table>";
      let headerDone = false;
      rows.forEach((row: string, idx: number) => {
        if (/^\|[\s\-:|]+\|$/.test(row.trim())) {
          headerDone = true;
          return;
        }
        const cells = row
          .split("|")
          .filter(
            (_c: string, i: number, arr: string[]) =>
              i > 0 && i < arr.length - 1
          );
        const tag = idx === 0 && !headerDone ? "th" : "td";
        const rowClass =
          idx === 0 ? "header" : idx % 2 === 0 ? "even" : "odd";
        tableHtml += `<tr class="${rowClass}">`;
        cells.forEach((cell: string) => {
          tableHtml += `<${tag}>${cell.trim()}</${tag}>`;
        });
        tableHtml += "</tr>";
      });
      tableHtml += "</table>\n";
      return tableHtml;
    }
  );

  html = html.replace(
    /(?:^|\n)((?:[\t ]*[-*+] .+\n?)+)/g,
    (_: string, listBlock: string) => {
      const items = listBlock
        .trim()
        .split("\n")
        .map((line: string) => {
          const match = line.match(/^[\t ]*[-*+] (.+)$/);
          return match ? `<li>${match[1]}</li>` : "";
        })
        .join("");
      return `\n<ul>${items}</ul>\n`;
    }
  );

  html = html.replace(
    /(?:^|\n)((?:[\t ]*\d+\. .+\n?)+)/g,
    (_: string, listBlock: string) => {
      const items = listBlock
        .trim()
        .split("\n")
        .map((line: string) => {
          const match = line.match(/^[\t ]*\d+\. (.+)$/);
          return match ? `<li>${match[1]}</li>` : "";
        })
        .join("");
      return `\n<ol>${items}</ol>\n`;
    }
  );

  html = html.replace(/^---+$/gm, "<hr />");

  const blocks = html.split("\n\n");
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|table|blockquote|pre|hr|div|img)/.test(trimmed)) {
        return trimmed;
      }
      if (/^%%CODEBLOCK_/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  codeBlocks.forEach((code, idx) => {
    html = html.replace(`%%CODEBLOCK_${idx}%%`, code);
  });

  return html;
}

const CHATGPT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 41 41" fill="none"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437-9.724-5.615 3.367-1.943a.121.121 0 0 1 .113-.012l8.051 4.649a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.649-1.131zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943 4.33-2.501 4.332 2.5v5l-4.331 2.5-4.331-2.5V18z" fill="currentColor"/></svg>`;

const LEXEND_FONT_URL = "https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap";

const EXPORT_STYLES = `
  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: 'Lexend', 'Inter', system-ui, -apple-system, sans-serif;
    color: #000000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pdf-document {
    max-width: 680px;
    margin: 0 auto;
    padding: 48px 56px;
    background: #ffffff;
  }

  .pdf-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
    color: #000000;
  }

  .pdf-logo svg { flex-shrink: 0; }

  .pdf-logo span {
    font-size: 14pt;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .pdf-title {
    margin: 0 0 28px;
    font-size: 26pt;
    font-weight: 700;
    line-height: 1.15;
    color: #000000;
    letter-spacing: -0.02em;
  }

  .pdf-body {
    font-size: 10.5pt;
    line-height: 1.72;
    color: #1a1a1a;
  }

  .pdf-body h1 {
    margin: 44px 0 16px;
    font-size: 21pt;
    font-weight: 700;
    line-height: 1.15;
    color: #000000;
    page-break-after: avoid;
  }

  .pdf-body h2 {
    margin: 36px 0 12px;
    font-size: 15pt;
    font-weight: 600;
    line-height: 1.2;
    color: #000000;
    page-break-after: avoid;
  }

  .pdf-body h3 {
    margin: 28px 0 10px;
    font-size: 12.5pt;
    font-weight: 600;
    line-height: 1.3;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  .pdf-body p {
    margin: 0 0 14px;
    text-align: justify;
    text-justify: inter-word;
  }

  .pdf-body strong {
    font-weight: 600;
    color: #000000;
  }

  .pdf-body em { font-style: italic; }

  .pdf-body a {
    color: #0066cc;
    text-decoration: underline;
  }

  .pdf-body ul,
  .pdf-body ol {
    margin: 14px 0;
    padding-left: 24px;
  }

  .pdf-body li { margin-bottom: 6px; }

  .pdf-body blockquote {
    margin: 20px 0;
    padding: 12px 16px;
    border-left: 3px solid #cccccc;
    background: transparent;
    color: #333333;
  }

  .pdf-body blockquote p { margin: 0 0 8px; }
  .pdf-body blockquote p:last-child { margin-bottom: 0; }

  .pdf-body .code-block {
    margin: 16px 0;
    padding: 14px 16px;
    border-radius: 6px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    color: #1a1a1a;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 9pt;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    break-inside: avoid;
  }

  .pdf-body .inline-code {
    padding: 1px 5px;
    border-radius: 3px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    color: #1a1a1a;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 9pt;
  }

  .pdf-body table {
    width: 100%;
    margin: 18px 0;
    border-collapse: collapse;
    border: 1px solid #d0d0d0;
    break-inside: avoid;
  }

  .pdf-body th {
    padding: 8px 12px;
    background: #f5f5f5;
    color: #000000;
    text-align: left;
    font-size: 9.5pt;
    font-weight: 600;
    border: 1px solid #d0d0d0;
  }

  .pdf-body td {
    padding: 8px 12px;
    border: 1px solid #d0d0d0;
    font-size: 10pt;
  }

  .pdf-body tr.even td { background: #fafafa; }

  .pdf-body hr {
    margin: 24px 0;
    border: none;
    border-top: 1px solid #e0e0e0;
  }

  .pdf-body del {
    color: #999999;
    text-decoration: line-through;
  }

  .pdf-body img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 16px 0;
    break-inside: avoid;
  }`;

function buildStyledHTML(
  content: string,
  contentType: ArtifactContentType,
  title: string
): string {
  const cleaned = cleanCitationMarkers(content).trim();
  const bodyHtml = contentType === "html" ? cleaned : markdownToHtml(cleaned);

  return `<style>${EXPORT_STYLES}</style>
<div class="pdf-document">
  <div class="pdf-logo">
    ${CHATGPT_LOGO_SVG}
    <span>ChatGPT</span>
  </div>
  <h1 class="pdf-title">${escapeHtml(title)}</h1>
  <div class="pdf-body">
    ${bodyHtml}
  </div>
</div>`;
}

function buildExportDocumentHTML(
  content: string,
  contentType: ArtifactContentType,
  title: string
): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="${LEXEND_FONT_URL}" />
  </head>
  <body>
    ${buildStyledHTML(content, contentType, title)}
  </body>
</html>`;
}

async function waitForIframeDocument(iframe: HTMLIFrameElement): Promise<Document> {
  return new Promise((resolve, reject) => {
    const handleLoad = () => {
      cleanup();
      if (iframe.contentDocument) {
        resolve(iframe.contentDocument);
        return;
      }
      reject(new Error("Nao consegui preparar o documento temporario do PDF."));
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Falha ao inicializar a area temporaria de exportacao do PDF."));
    };

    const cleanup = () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
    };

    iframe.addEventListener("load", handleLoad, { once: true });
    iframe.addEventListener("error", handleError, { once: true });
  });
}

async function waitForLayout(doc: Document): Promise<void> {
  if (doc.fonts?.ready) {
    await doc.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    doc.defaultView?.requestAnimationFrame(() => resolve());
  });
  await new Promise<void>((resolve) => {
    doc.defaultView?.requestAnimationFrame(() => resolve());
  });
}

function sanitizeUnsupportedColors(document: Document): void {
  const UNSUPPORTED_COLOR_FUNCTION_RE =
    /(oklch|oklab|lch|lab|hwb|color-mix)\([^;]+?\)/gi;

  document.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const rawStyle = element.getAttribute("style");
    if (!rawStyle) return;

    const sanitized = rawStyle.replace(UNSUPPORTED_COLOR_FUNCTION_RE, "transparent");
    if (sanitized !== rawStyle) {
      element.setAttribute("style", sanitized);
    }
  });

  document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
    node.parentNode?.removeChild(node);
  });
}

export async function downloadArtifactPDF(
  content: string,
  options: ArtifactPDFOptions = {}
): Promise<void> {
  const cleanedContent = cleanCitationMarkers(content).trim();
  if (!cleanedContent) {
    throw new Error("Nao ha conteudo suficiente para exportar este documento.");
  }

  const title = options.title?.trim() || "Documento";
  const contentType = options.contentType || "markdown";
  const baseName = options.filename || options.title || "documento";
  const exportHTML = buildExportDocumentHTML(cleanedContent, contentType, title);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "100vw";
  iframe.style.bottom = "0";
  iframe.style.width = "860px";
  iframe.style.height = "1200px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  iframe.style.background = "#ffffff";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  try {
    const readyDocument = waitForIframeDocument(iframe);
    iframe.src = "about:blank";
    const iframeDocument = await readyDocument;
    iframeDocument.open();
    iframeDocument.write(exportHTML);
    iframeDocument.close();

    await waitForLayout(iframeDocument);

    const html2pdf = (await import("html2pdf.js")).default;
    const exportRoot =
      (iframeDocument.querySelector(".pdf-document") as HTMLElement | null) ??
      iframeDocument.body;

    await html2pdf()
      .set({
        margin: [12, 10, 16, 10],
        filename: `${sanitizeFilename(baseName)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 800,
          onclone: (clonedDocument: Document) => {
            sanitizeUnsupportedColors(clonedDocument);

            const fontLink = clonedDocument.createElement("link");
            fontLink.rel = "stylesheet";
            fontLink.href = LEXEND_FONT_URL;
            clonedDocument.head.appendChild(fontLink);

            const style = clonedDocument.createElement("style");
            style.textContent = EXPORT_STYLES;
            clonedDocument.head.appendChild(style);
          },
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      })
      .from(exportRoot)
      .save();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Falha inesperada ao montar o PDF do documento."
    );
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
