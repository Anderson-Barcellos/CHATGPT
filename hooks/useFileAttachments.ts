"use client";

import { useState, useCallback } from "react";
import type { FileAttachment, FileAttachmentType } from "@/types";

const MAX_FILES = 10;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIM = 2048;
const THUMB_SIZE = 200;
const MAX_TEXT_CHARS = 100_000;
const MAX_PDF_PAGES = 50;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".xml", ".log", ".yaml", ".yml", ".toml", ".ini", ".env", ".sh", ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css"]);

function getAttachmentType(file: File): FileAttachmentType | null {
  if (IMAGE_TYPES.has(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith("text/")) return "text";
  return null;
}

function resizeImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context failed")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const mimeOut = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = file.type === "image/png" ? undefined : 0.85;
      resolve(canvas.toDataURL(mimeOut, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function makeThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const ratio = Math.min(THUMB_SIZE / width, THUMB_SIZE / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context failed")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Thumbnail failed"));
    img.src = dataUrl;
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let text = reader.result as string;
      if (text.length > MAX_TEXT_CHARS) {
        text = text.slice(0, MAX_TEXT_CHARS) + `\n\n[...truncado em ${MAX_TEXT_CHARS.toLocaleString()} caracteres]`;
      }
      resolve(text);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (text.trim()) pages.push(`[Pagina ${i}]\n${text}`);
  }

  let result = pages.join("\n\n");
  if (pdf.numPages > MAX_PDF_PAGES) {
    result += `\n\n[...PDF truncado: ${pdf.numPages} paginas total, mostrando ${MAX_PDF_PAGES}]`;
  }
  return result;
}

export interface FileProcessingError {
  fileName: string;
  error: string;
}

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<FileProcessingError[]>([]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: FileProcessingError[] = [];

    let currentCount = 0;
    setAttachments((current) => {
      currentCount = current.length;
      if (currentCount >= MAX_FILES) {
        newErrors.push({ fileName: "geral", error: `Maximo de ${MAX_FILES} arquivos atingido` });
      }
      return current;
    });

    setIsProcessing(true);
    setErrors([]);

    const toProcess = fileArray.slice(0, MAX_FILES - currentCount);

    const processed: FileAttachment[] = [];

    for (const file of toProcess) {
      const type = getAttachmentType(file);
      if (!type) {
        newErrors.push({ fileName: file.name, error: "Tipo de arquivo nao suportado" });
        continue;
      }

      if (type === "image" && file.size > MAX_IMAGE_SIZE) {
        newErrors.push({ fileName: file.name, error: "Imagem muito grande (max 20MB)" });
        continue;
      }

      if ((type === "pdf" || type === "text") && file.size > MAX_TEXT_SIZE) {
        newErrors.push({ fileName: file.name, error: "Arquivo muito grande (max 10MB)" });
        continue;
      }

      try {
        const attachment: FileAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        };

        if (type === "image") {
          attachment.dataUrl = await resizeImage(file, MAX_IMAGE_DIM);
          attachment.thumbnailUrl = await makeThumbnail(attachment.dataUrl);
        } else if (type === "pdf") {
          attachment.extractedText = await extractPdfText(file);
        } else {
          attachment.extractedText = await readAsText(file);
        }

        processed.push(attachment);
      } catch (err) {
        newErrors.push({
          fileName: file.name,
          error: err instanceof Error ? err.message : "Erro ao processar arquivo",
        });
      }
    }

    setAttachments((current) => [...current, ...processed]);
    if (newErrors.length > 0) setErrors(newErrors);
    setIsProcessing(false);
  }, []);

  const removeFile = useCallback((id: string) => {
    setAttachments((current) => current.filter((a) => a.id !== id));
  }, []);

  const clearFiles = useCallback(() => {
    setAttachments([]);
    setErrors([]);
  }, []);

  return { attachments, isProcessing, errors, addFiles, removeFile, clearFiles };
}
