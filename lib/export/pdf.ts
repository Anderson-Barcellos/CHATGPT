import jsPDF from "jspdf";
import { Conversation, ModelParameters } from "@/types";

export interface PDFExportOptions {
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeReasoning?: boolean;
  includeImages?: boolean;
  modelParameters?: ModelParameters;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const LINE_HEIGHT = 7;
const MAX_WIDTH = PAGE_WIDTH - 2 * MARGIN;

export async function exportToPDF(
  conversation: Conversation,
  options: PDFExportOptions = {}
): Promise<jsPDF> {
  const {
    includeMetadata = true,
    includeTimestamps = true,
    includeReasoning = true,
    includeImages = true,
    modelParameters,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let yPosition = MARGIN;

  function addHeader() {
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`${conversation.title}`, MARGIN, 10);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, PAGE_WIDTH - MARGIN, 10, {
      align: "right",
    });
    doc.line(MARGIN, 12, PAGE_WIDTH - MARGIN, 12);
  }

  function checkPageBreak(neededSpace: number = LINE_HEIGHT * 2) {
    if (yPosition + neededSpace > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      yPosition = MARGIN + 5;
      addHeader();
      yPosition += 10;
    }
  }

  function addText(
    text: string,
    fontSize: number = 10,
    isBold: boolean = false,
    color: [number, number, number] = [0, 0, 0]
  ) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, MAX_WIDTH);
    const neededSpace = lines.length * LINE_HEIGHT;

    checkPageBreak(neededSpace);

    lines.forEach((line: string) => {
      doc.text(line, MARGIN, yPosition);
      yPosition += LINE_HEIGHT;
    });
  }

  function addSpacer(space: number = LINE_HEIGHT) {
    yPosition += space;
    checkPageBreak();
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(conversation.title, MARGIN, yPosition);
  yPosition += 12;

  if (includeMetadata) {
    doc.line(MARGIN, yPosition, PAGE_WIDTH - MARGIN, yPosition);
    yPosition += 8;

    addText(`Created: ${new Date(conversation.createdAt).toLocaleString()}`, 9, false, [
      100,
      100,
      100,
    ]);
    addText(`Updated: ${new Date(conversation.updatedAt).toLocaleString()}`, 9, false, [
      100,
      100,
      100,
    ]);
    addText(`Messages: ${conversation.messages.length}`, 9, false, [100, 100, 100]);

    if (modelParameters) {
      addSpacer();
      addText("Model Configuration", 11, true);
      addText(`Model: ${modelParameters.model}`, 9);
      addText(`Temperature: ${modelParameters.temperature}`, 9);
      addText(`Max Tokens: ${modelParameters.maxOutputTokens}`, 9);
      addText(`Reasoning: ${modelParameters.reasoningEffort}`, 9);
    }

    addSpacer(10);
    doc.line(MARGIN, yPosition, PAGE_WIDTH - MARGIN, yPosition);
    addSpacer(10);
  }

  addText("Conversation", 14, true);
  addSpacer(5);

  for (let i = 0; i < conversation.messages.length; i++) {
    const message = conversation.messages[i];
    const isUser = message.role === "user";

    checkPageBreak(LINE_HEIGHT * 3);

    if (isUser) {
      doc.setFillColor(240, 240, 240);
    } else {
      doc.setFillColor(230, 245, 255);
    }
    doc.rect(MARGIN - 2, yPosition - 5, MAX_WIDTH + 4, 8, "F");

    const roleText = isUser ? "User" : "Assistant";
    const timestampText = includeTimestamps
      ? ` - ${new Date(message.timestamp).toLocaleString()}`
      : "";

    addText(`${roleText}${timestampText}`, 11, true, isUser ? [0, 100, 0] : [0, 0, 150]);
    addSpacer(3);

    if (includeImages && message.imageBase64 && message.imageMimeType) {
      try {
        checkPageBreak(60);
        doc.addImage(
          `data:${message.imageMimeType};base64,${message.imageBase64}`,
          "JPEG",
          MARGIN,
          yPosition,
          MAX_WIDTH / 2,
          50
        );
        yPosition += 55;
      } catch (error) {
        addText("[Image could not be embedded]", 9, false, [150, 150, 150]);
      }
    }

    addText(message.content, 10);
    addSpacer(5);

    if (includeReasoning && message.reasoningText) {
      doc.setFillColor(255, 255, 230);
      const reasoningLines = doc.splitTextToSize(
        `Reasoning: ${message.reasoningText}`,
        MAX_WIDTH - 10
      );
      const boxHeight = reasoningLines.length * LINE_HEIGHT + 5;
      checkPageBreak(boxHeight);
      doc.rect(MARGIN, yPosition - 3, MAX_WIDTH, boxHeight, "F");
      addText(`Reasoning: ${message.reasoningText}`, 8, false, [80, 80, 0]);
      addSpacer(5);
    }

    if (includeReasoning && message.reasoningSummary) {
      addText(`Summary: ${message.reasoningSummary}`, 9, false, [100, 100, 100]);
      addSpacer(5);
    }

    if (i < conversation.messages.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.line(MARGIN, yPosition, PAGE_WIDTH - MARGIN, yPosition);
      addSpacer(8);
    }
  }

  addSpacer(10);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Exported on ${new Date().toLocaleString()}`, MARGIN, yPosition);

  return doc;
}

export async function downloadPDF(
  conversation: Conversation,
  options?: PDFExportOptions
): Promise<void> {
  const doc = await exportToPDF(conversation, options);
  doc.save(`${sanitizeFilename(conversation.title)}.pdf`);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}
