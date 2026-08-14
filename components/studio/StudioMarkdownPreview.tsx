"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { chatMarkdownComponents } from "@/components/chat/chatMarkdownRenderer";
import styles from "@/components/studio/GauchoStudioShell.module.css";

// Diferente do ChatMarkdown, aqui o conteúdo é um arquivo .md real: sem
// normalizeChatMarkdown (heurística para saída de LLM) e sem remarkBreaks
// (quebra simples em arquivo é soft wrap, não <br>).
const previewRemarkPlugins = [remarkGfm, remarkMath];
const previewRehypePlugins = [rehypeKatex];

interface StudioMarkdownPreviewProps {
  content: string;
}

export function StudioMarkdownPreview({ content }: StudioMarkdownPreviewProps) {
  return (
    <div
      className={styles.markdownPreview}
      aria-label="Preview do markdown"
      data-visual-theme="atmosphere-glass"
    >
      <div className="max-w-full break-words text-left text-body-sm [overflow-wrap:anywhere] md:text-body">
        <ReactMarkdown
          skipHtml
          remarkPlugins={previewRemarkPlugins}
          rehypePlugins={previewRehypePlugins}
          components={chatMarkdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
