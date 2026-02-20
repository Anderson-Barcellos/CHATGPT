"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  Code,
  Copy,
  Check,
  Download,
  Maximize2,
  Minimize2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, ArtifactContentType } from "@/stores/uiStore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { CodeBlock } from "@/components/chat/CodeBlock";

function HtmlPreview({ content }: { content: string }) {
  const srcDoc = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6; padding: 20px; max-width: 100%; overflow-x: auto;
    color: #e2e8f0; background: #0f172a;
  }
  pre { background: #1e293b; padding: 12px; border-radius: 8px; overflow-x: auto; }
  code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #334155; padding: 8px 12px; text-align: left; }
  th { background: #1e293b; }
  img, svg { max-width: 100%; height: auto; }
  a { color: #38bdf8; }
  h1, h2, h3 { color: #f1f5f9; margin: 16px 0 8px; }
</style>
</head><body>${content}</body></html>`;

  return (
    <iframe
      srcDoc={srcDoc}
      className="w-full h-full border-0 rounded-lg bg-slate-900"
      title="HTML Preview"
      sandbox="allow-scripts"
    />
  );
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none prose-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
        components={{
          code: ({ className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className || !match;

            if (!isInline && language) {
              return (
                <CodeBlock
                  language={language}
                  value={String(children).replace(/\n$/, "")}
                />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
              </table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="rounded-lg shadow-md max-w-full h-auto" loading="lazy" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ArtifactPanel() {
  const { artifactOpen, artifactContent, artifactType, artifactTitle, closeArtifact } = useUIStore();
  const [activeTab, setActiveTab] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (artifactOpen) setActiveTab("preview");
  }, [artifactOpen]);

  useEffect(() => {
    if (!artifactOpen) setIsFullscreen(false);
  }, [artifactOpen]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(artifactContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [artifactContent]);

  const handleDownload = useCallback(() => {
    const ext = artifactType === "html" ? "html" : "md";
    const mime = artifactType === "html" ? "text/html" : "text/markdown";
    const blob = new Blob([artifactContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifactTitle || "document"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [artifactContent, artifactType, artifactTitle]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-white/10 bg-background/80 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold truncate">{artifactTitle || "Documento"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab as any} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="preview"><Eye className="mr-1.5 h-3.5 w-3.5" />Preview</TabsTrigger>
            <TabsTrigger value="source"><Code className="mr-1.5 h-3.5 w-3.5" />Fonte</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="flex-1 overflow-auto p-4">
            {artifactType === "html" ? (
              <HtmlPreview content={artifactContent} />
            ) : (
              <MarkdownPreview content={artifactContent} />
            )}
          </TabsContent>
          <TabsContent value="source" className="flex-1 overflow-auto p-4">
            <CodeBlock language={artifactType === "html" ? "html" : "markdown"} value={artifactContent} showLineNumbers />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Sheet open={artifactOpen} onOpenChange={(open) => { if (!open) closeArtifact(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[92vw] sm:max-w-2xl p-0 flex flex-col glass border-l border-white/10"
      >
        <SheetHeader className="flex-none border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm truncate">
                  {artifactTitle || "Documento"}
                </SheetTitle>
                <SheetDescription className="text-xs uppercase tracking-widest text-muted-foreground/60">
                  {artifactType === "html" ? "HTML Interativo" : "Documento Rico"}
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(true)}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab as any}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="preview">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source">
              <Code className="mr-1.5 h-3.5 w-3.5" />
              Fonte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            {artifactType === "html" ? (
              <div className="h-full p-4">
                <HtmlPreview content={artifactContent} />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-4">
                  <MarkdownPreview content={artifactContent} />
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="source" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <CodeBlock
                  language={artifactType === "html" ? "html" : "markdown"}
                  value={artifactContent}
                  showLineNumbers
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
