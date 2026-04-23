"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
  ClipboardList,
} from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { CodeBlock } from "@/components/chat/CodeBlock";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { downloadArtifactPDF } from "@/lib/export/artifactPdf";
import { DocumentCanvas } from "@/components/artifacts/DocumentCanvas";
import { QuizCanvas } from "@/components/artifacts/QuizCanvas";
import { useArtifactSessionPersistence } from "@/hooks/useArtifactSessionPersistence";
import { getQuizSourceContent } from "@/lib/artifacts/quizArtifacts";
import { QuizMessageArtifact } from "@/types";

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
      sandbox=""
    />
  );
}

export function ArtifactPanel() {
  const { artifactOpen, activeArtifact, artifactMessageId, closeArtifact } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const persistArtifactSession = useArtifactSessionPersistence();

  const artifactTitle = activeArtifact?.title || "Documento";
  const documentArtifact = activeArtifact?.kind === "document" ? activeArtifact : null;
  const quizArtifact = activeArtifact?.kind === "quiz" ? activeArtifact : null;
  const isQuizArtifact = quizArtifact !== null;
  const artifactContent = documentArtifact
    ? documentArtifact.content
    : quizArtifact
      ? getQuizSourceContent(quizArtifact.quiz)
      : "";
  const artifactSourceLanguage = documentArtifact
    ? documentArtifact.type === "html"
      ? "html"
      : "markdown"
    : "json";
  const canDownloadPdf = documentArtifact !== null;
  const downloadExtension = documentArtifact
    ? documentArtifact.type === "html"
      ? "html"
      : "md"
    : "json";
  const downloadMime = documentArtifact
    ? documentArtifact.type === "html"
      ? "text/html"
      : "text/markdown"
    : "application/json";
  const documentEyebrow =
    documentArtifact?.type === "html"
      ? "Visualizacao interativa"
      : isQuizArtifact
      ? "Quiz interativo"
      : "Documento pronto para leitura";
  const documentDescription =
    documentArtifact?.type === "html"
      ? "Conteudo HTML em modo de leitura, preservando a estrutura do artefato."
      : isQuizArtifact
      ? "Responda as questoes, envie no final e mantenha a nota salva nesta conversa."
      : "Leitura em coluna unica com tipografia editorial e exportacao em PDF alinhada ao preview.";

  const handleQuizSessionChange = useCallback(
    async (session: QuizMessageArtifact["quiz"]["session"]) => {
      if (!artifactMessageId || !quizArtifact) return;

      await persistArtifactSession(artifactMessageId, {
        ...quizArtifact,
        quiz: {
          ...quizArtifact.quiz,
          session,
        },
      });
    },
    [artifactMessageId, persistArtifactSession, quizArtifact]
  );

  const handleCopy = useCallback(async () => {
    if (!activeArtifact) return;

    try {
      await navigator.clipboard.writeText(artifactContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }, [activeArtifact, artifactContent]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;

    const blob = new Blob([artifactContent], { type: downloadMime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifactTitle || "document"}.${downloadExtension}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeArtifact, artifactContent, artifactTitle, downloadExtension, downloadMime]);

  const handleDownloadPDF = useCallback(async () => {
    if (!documentArtifact) return;

    try {
      await downloadArtifactPDF(artifactContent, {
        title: artifactTitle || "Documento",
        contentType: documentArtifact.type,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao exportar o documento em PDF.";
      toast.error("PDF nao exportado", { description: message });
    }
  }, [artifactContent, artifactTitle, documentArtifact]);

  if (!activeArtifact) {
    return null;
  }

  if (artifactOpen && isFullscreen) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-white/10 bg-background/70 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-2">
            {isQuizArtifact ? (
              <ClipboardList className="h-4 w-4 text-primary/80" />
            ) : (
              <FileText className="h-4 w-4 text-primary/80" />
            )}
            <span className="text-sm font-medium text-foreground/90 truncate">{artifactTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            {canDownloadPdf && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleDownloadPDF}>
                PDF
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit rounded-full bg-white/[0.04] p-1">
            <TabsTrigger value="preview" className="rounded-full text-xs data-[state=active]:bg-background/80">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source" className="rounded-full text-xs data-[state=active]:bg-background/80">
              <Code className="mr-1.5 h-3.5 w-3.5" />
              Fonte
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="flex-1 overflow-auto p-4">
            {isQuizArtifact ? (
              <QuizCanvas
                artifact={quizArtifact!}
                onSessionChange={handleQuizSessionChange}
              />
            ) : documentArtifact!.type === "html" ? (
              <HtmlPreview content={artifactContent} />
            ) : (
              <DocumentCanvas
                title={artifactTitle}
                eyebrow={documentEyebrow}
                description={documentDescription}
                className="border-black/5 bg-transparent dark:border-white/8 dark:bg-transparent"
                bodyClassName="md:py-9"
              >
                <ChatMarkdown
                  content={artifactContent}
                  className="max-w-none"
                />
              </DocumentCanvas>
            )}
          </TabsContent>
          <TabsContent value="source" className="flex-1 overflow-auto p-4">
            <CodeBlock language={artifactSourceLanguage} value={artifactContent} showLineNumbers />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Sheet
      open={artifactOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsFullscreen(false);
          closeArtifact();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[96vw] sm:max-w-4xl p-0 flex flex-col glass border-l border-white/10"
      >
        <SheetHeader className="flex-none border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                {isQuizArtifact ? (
                  <ClipboardList className="h-4 w-4 text-primary/85" />
                ) : (
                  <FileText className="h-4 w-4 text-primary/85" />
                )}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-sm font-medium truncate">
                  {artifactTitle}
                </SheetTitle>
                <SheetDescription className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/55">
                  {isQuizArtifact
                    ? "Quiz Interativo"
                    : documentArtifact!.type === "html"
                    ? "HTML Interativo"
                    : "Documento Rico"}
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
              {canDownloadPdf && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleDownloadPDF}>
                  PDF
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(true)}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit rounded-full bg-white/[0.04] p-1">
            <TabsTrigger value="preview" className="rounded-full">
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="source" className="rounded-full">
              <Code className="mr-1.5 h-3.5 w-3.5" />
              Fonte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            {isQuizArtifact ? (
              <ScrollArea className="h-full">
                <div className="p-4">
                  <QuizCanvas
                    artifact={quizArtifact!}
                    onSessionChange={handleQuizSessionChange}
                  />
                </div>
              </ScrollArea>
            ) : documentArtifact!.type === "html" ? (
              <div className="h-full p-4">
                <HtmlPreview content={artifactContent} />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-4">
                  <DocumentCanvas
                    title={artifactTitle || "Documento"}
                    eyebrow={documentEyebrow}
                    description={documentDescription}
                    className="border-black/5 bg-transparent dark:border-white/8 dark:bg-transparent"
                    bodyClassName="md:py-9"
                  >
                    <ChatMarkdown
                      content={artifactContent}
                      className="max-w-none"
                    />
                  </DocumentCanvas>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="source" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <CodeBlock
                  language={artifactSourceLanguage}
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
