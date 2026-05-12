import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { DocumentMessageArtifact } from "@/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
const RASTER_SCALE = 2;

function isClippingOverflow(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "auto" ||
    normalized === "scroll" ||
    normalized === "hidden" ||
    normalized === "clip"
  );
}

function relaxScrollableLayout(root: HTMLElement): void {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  nodes.forEach((node) => {
    const computed = window.getComputedStyle(node);
    const overflowY = computed.overflowY;
    const overflowX = computed.overflowX;
    const clipsY = isClippingOverflow(overflowY);
    const clipsX = isClippingOverflow(overflowX);
    const hasVerticalClipping = node.scrollHeight > node.clientHeight + 1;
    const hasHorizontalClipping = node.scrollWidth > node.clientWidth + 1;

    if (clipsY || clipsX || hasVerticalClipping || hasHorizontalClipping) {
      node.style.setProperty("overflow", "visible", "important");
      node.style.setProperty("overflow-y", "visible", "important");
      node.style.setProperty("overflow-x", "visible", "important");
    }

    if (clipsY || hasVerticalClipping) {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("max-height", "none", "important");
      node.style.setProperty("min-height", "0", "important");
    }
  });
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}

function sanitizeHtmlForSnapshot(rawHtml: string): string {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(rawHtml, "text/html");

  parsed.querySelectorAll("script,iframe,object,embed").forEach((node) => {
    node.remove();
  });

  parsed.querySelectorAll("*").forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attr.name);
      }
    }
  });

  return parsed.body.innerHTML;
}

function createSnapshotShell(title: string): HTMLDivElement {
  const shell = document.createElement("div");
  shell.setAttribute("data-document-pdf-shell", "true");
  shell.style.position = "fixed";
  shell.style.left = "-100000px";
  shell.style.top = "0";
  shell.style.width = "794px";
  shell.style.padding = "0";
  shell.style.background = "#ffffff";
  shell.style.zIndex = "-1";

  const page = document.createElement("article");
  page.setAttribute("data-document-pdf-page", "true");
  page.style.width = "794px";
  page.style.minHeight = "1123px";
  page.style.boxSizing = "border-box";
  page.style.background = "#ffffff";
  page.style.border = "1px solid #e2e8f0";
  page.style.padding = "16px";
  page.style.overflow = "hidden";
  page.setAttribute("aria-label", title || "Documento");

  shell.appendChild(page);
  document.body.appendChild(shell);
  return shell;
}

function getPageElement(shell: HTMLDivElement): HTMLElement {
  const page = shell.querySelector<HTMLElement>("[data-document-pdf-page='true']");
  if (!page) {
    throw new Error("Nao consegui preparar a area de captura do PDF.");
  }
  return page;
}

async function buildSnapshotCanvas(
  artifact: DocumentMessageArtifact,
  sourceElement: HTMLElement | null
): Promise<HTMLCanvasElement> {
  const shell = createSnapshotShell(artifact.title);

  try {
    const page = getPageElement(shell);

    if (artifact.type === "html") {
      page.innerHTML = sanitizeHtmlForSnapshot(artifact.content);
    } else if (sourceElement) {
      const clone = sourceElement.cloneNode(true) as HTMLElement;
      clone.style.setProperty("width", "100%", "important");
      clone.style.setProperty("height", "auto", "important");
      clone.style.setProperty("max-height", "none", "important");
      clone.style.setProperty("overflow", "visible", "important");
      page.appendChild(clone);
      relaxScrollableLayout(clone);
    } else {
      const fallback = document.createElement("pre");
      fallback.style.whiteSpace = "pre-wrap";
      fallback.style.wordBreak = "break-word";
      fallback.style.margin = "0";
      fallback.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      fallback.style.fontSize = "12px";
      fallback.textContent = artifact.content;
      page.appendChild(fallback);
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    return html2canvas(page, {
      backgroundColor: "#ffffff",
      scale: RASTER_SCALE,
      useCORS: true,
      logging: false,
      windowWidth: page.scrollWidth,
      windowHeight: page.scrollHeight,
    });
  } finally {
    shell.remove();
  }
}


function extractTextFromArtifact(artifact: DocumentMessageArtifact, sourceElement: HTMLElement | null): string {
  if (sourceElement) {
    const text = sourceElement.innerText?.trim();
    if (text) return text;
  }

  if (artifact.type === "html") {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(artifact.content, "text/html");
    const text = parsed.body.textContent?.trim();
    if (text) return text;
  }

  return artifact.content;
}

function appendTextFallbackPdf(pdf: jsPDF, text: string): void {
  const printableWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const printableHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
  const lineHeightMm = 5.4;
  const linesPerPage = Math.max(1, Math.floor(printableHeightMm / lineHeightMm));
  const lines = pdf.splitTextToSize(text || "Documento vazio.", printableWidthMm);

  for (let i = 0; i < lines.length; i += linesPerPage) {
    if (i > 0) {
      pdf.addPage();
    }

    const pageLines = lines.slice(i, i + linesPerPage);
    pdf.text(pageLines, PAGE_MARGIN_MM, PAGE_MARGIN_MM + 4);
  }
}
function appendCanvasAsPaginatedPdf(pdf: jsPDF, canvas: HTMLCanvasElement): void {
  const printableWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const printableHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2;
  const pxPerMm = canvas.width / printableWidthMm;
  const pageHeightPx = Math.max(1, Math.floor(printableHeightMm * pxPerMm));

  let cursorPx = 0;
  let pageIndex = 0;

  while (cursorPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - cursorPx);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Nao consegui renderizar a pagina para o PDF.");
    }

    ctx.drawImage(
      canvas,
      0,
      cursorPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const renderedHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(
      pageCanvas,
      "PNG",
      PAGE_MARGIN_MM,
      PAGE_MARGIN_MM,
      printableWidthMm,
      renderedHeightMm,
      undefined,
      "FAST"
    );

    cursorPx += sliceHeightPx;
    pageIndex += 1;
  }
}

export async function downloadDocumentArtifactPdf(
  artifact: DocumentMessageArtifact,
  sourceElement: HTMLElement | null
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  try {
    const canvas = await buildSnapshotCanvas(artifact, sourceElement);
    appendCanvasAsPaginatedPdf(pdf, canvas);
  } catch {
    const fallbackText = extractTextFromArtifact(artifact, sourceElement);
    appendTextFallbackPdf(pdf, fallbackText);
  }

  pdf.save(`${sanitizeFilename(artifact.title || "documento")}.pdf`);
}
