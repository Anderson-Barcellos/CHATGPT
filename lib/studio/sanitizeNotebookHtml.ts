import DOMPurify from "dompurify";

// <style> sai porque um output de célula não pode vazar CSS pro documento
// (a tabela do pandas é estilizada pelo CSS do próprio Studio).
export function sanitizeNotebookHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style"],
  });
}
