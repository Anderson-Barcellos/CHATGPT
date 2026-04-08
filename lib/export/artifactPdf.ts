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

const OPENAI_KNOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>`;

const INTER_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

const EXPORT_STYLES = `
  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #000000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pdf-document {
    max-width: 760px;
    margin: 0 auto;
    padding: 30px 34px 34px;
    background: #ffffff;
  }

  .pdf-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 22px;
    color: #000000;
  }

  .pdf-logo svg { flex-shrink: 0; }

  .pdf-logo span {
    font-size: 12.5pt;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  .pdf-title {
    margin: 0 0 20px;
    font-size: 22pt;
    font-weight: 700;
    line-height: 1.12;
    color: #000000;
    letter-spacing: -0.02em;
  }

  .pdf-body {
    font-size: 9.75pt;
    line-height: 1.58;
    color: #1a1a1a;
  }

  .pdf-body h1 {
    margin: 28px 0 12px;
    font-size: 18pt;
    font-weight: 700;
    line-height: 1.15;
    color: #000000;
    page-break-after: avoid;
  }

  .pdf-body h2 {
    margin: 24px 0 10px;
    font-size: 13.5pt;
    font-weight: 600;
    line-height: 1.2;
    color: #000000;
    page-break-after: avoid;
  }

  .pdf-body h3 {
    margin: 20px 0 8px;
    font-size: 11.25pt;
    font-weight: 600;
    line-height: 1.3;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  .pdf-body p {
    margin: 0 0 10px;
    text-align: left;
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
    margin: 10px 0 12px;
    padding-left: 20px;
  }

  .pdf-body li { margin-bottom: 4px; }

  .pdf-body blockquote {
    margin: 16px 0;
    padding: 10px 14px;
    border-left: 3px solid #cccccc;
    background: transparent;
    color: #333333;
  }

  .pdf-body blockquote p { margin: 0 0 6px; }
  .pdf-body blockquote p:last-child { margin-bottom: 0; }

  .pdf-body .code-block {
    margin: 14px 0;
    padding: 12px 14px;
    border-radius: 6px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    color: #1a1a1a;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 8.5pt;
    line-height: 1.45;
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
    font-size: 8.5pt;
  }

  .pdf-body table {
    width: 100%;
    margin: 14px 0;
    border-collapse: collapse;
    border: 1px solid #d0d0d0;
    break-inside: avoid;
  }

  .pdf-body th {
    padding: 7px 10px;
    background: #f5f5f5;
    color: #000000;
    text-align: left;
    font-size: 9pt;
    font-weight: 600;
    border: 1px solid #d0d0d0;
  }

  .pdf-body td {
    padding: 7px 10px;
    border: 1px solid #d0d0d0;
    font-size: 9.25pt;
  }

  .pdf-body tr.even td { background: #fafafa; }

  .pdf-body hr {
    margin: 18px 0;
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
    margin: 12px 0;
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
    ${OPENAI_KNOT_SVG}
    <span>OpenAI</span>
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
    <link rel="stylesheet" href="${INTER_FONT_URL}" />
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
        margin: [7, 7, 9, 7],
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
            fontLink.href = INTER_FONT_URL;
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
