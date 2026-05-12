interface OpenA4PrintWindowOptions {
  title: string;
  bodyHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collectHeadStyles(): string {
  return Array.from(document.querySelectorAll("style,link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("\n");
}

export function openA4PrintWindow({
  title,
  bodyHtml,
}: OpenA4PrintWindowOptions): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=1200,height=900"
  );

  if (!printWindow) {
    return false;
  }

  const safeTitle = escapeHtml(title || "Documento");
  const styles = collectHeadStyles();
  const rootClass = document.documentElement.className;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="pt-BR" class="${rootClass}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
    ${styles}
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #f1f5f9;
      }

      .a4-print-shell {
        min-height: 100vh;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .a4-print-page {
        width: 210mm;
        min-height: 297mm;
        box-sizing: border-box;
        background: white;
        border: 1px solid #e2e8f0;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
        overflow: hidden;
      }

      @media print {
        html,
        body {
          background: white;
        }

        .a4-print-shell {
          padding: 0;
          min-height: auto;
        }

        .a4-print-page {
          width: auto;
          min-height: auto;
          border: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="a4-print-shell">
      <article class="a4-print-page">${bodyHtml}</article>
    </main>
  </body>
</html>`);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  printWindow.addEventListener("load", () => {
    window.setTimeout(triggerPrint, 180);
  });

  return true;
}
