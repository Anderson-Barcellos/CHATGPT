"use client";

import { Message } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./CodeBlock";
import { Button } from "@/components/ui/button";
import { PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

interface MessageContentProps {
  message: Message;
  className?: string;
}

// Detect if content should be rendered in rich viewer
function detectRichContent(content: string): {
  isRich: boolean;
  type: "markdown" | "html" | "mixed";
} {
  // Check for HTML tags
  const hasHtml = /<(html|body|script|style|svg|canvas)/i.test(content);
  
  // Check for complex markdown (tables, mermaid, etc)
  const hasComplexMarkdown = 
    content.includes('```mermaid') ||
    content.includes('```html') ||
    content.includes('```svg') ||
    content.includes('<table>') ||
    content.includes('|---|---|') || // Markdown tables
    content.split('```').length > 4; // Multiple code blocks
  
  // Check for document markers
  const hasDocumentMarkers = 
    content.includes('# ') && // Headers
    content.includes('## ') &&
    (content.includes('### ') || content.includes('- [ ]')); // Complex structure
  
  if (hasHtml) {
    return { isRich: true, type: "html" };
  } else if (hasComplexMarkdown || hasDocumentMarkers) {
    return { isRich: true, type: "markdown" };
  }
  
  return { isRich: false, type: "markdown" };
}

function cleanCitationMarkers(text: string): string {
  return text.replace(/【\d+[:\d]*†[^】]*】/g, "").replace(/\[\d+\]\s*/g, "");
}

export function MessageContent({ message, className }: MessageContentProps) {
  const { openArtifact } = useUIStore();
  const content = cleanCitationMarkers(message.content);
  const richContent = detectRichContent(content);

  if (message.imageBase64) {
    return (
      <div className={cn("space-y-3", className)}>
        {content && content.trim().length > 0 && (
          <div className="prose prose-slate dark:prose-invert max-w-none prose-sm text-left">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeHighlight, rehypeKatex]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        <div className="rounded-lg overflow-hidden">
          <img
            src={`data:${message.imageMimeType || "image/png"};base64,${message.imageBase64}`}
            alt="Generated image"
            className="w-full h-auto rounded-lg shadow-lg"
          />
        </div>
      </div>
    );
  }

  if (richContent.isRich) {
    return (
      <div className={cn("space-y-3", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            openArtifact(
              content,
              richContent.type,
              richContent.type === "html" ? "HTML Interativo" : "Documento"
            )
          }
          className="h-7 gap-1.5 text-xs rounded-full border-primary/20 hover:bg-primary/5"
        >
          <PanelRightOpen className="h-3 w-3" />
          Abrir no painel
        </Button>

        <div className="prose prose-slate dark:prose-invert max-w-none prose-sm text-left">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={{
              code: ({ className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                const isInline = !className || !match;

                if (!isInline && language) {
                  return (
                    <CodeBlock
                      language={language}
                      value={String(children).replace(/\n$/, '')}
                    />
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // Regular markdown content
  return (
    <div className={cn("prose prose-slate dark:prose-invert max-w-none prose-sm text-left", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
        components={{
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className || !match;
            
            if (!isInline && language) {
              return (
                <CodeBlock
                  language={language}
                  value={String(children).replace(/\n$/, '')}
                />
              );
            }
            
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
