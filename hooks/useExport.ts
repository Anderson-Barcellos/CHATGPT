import { useState } from "react";
import { toast } from "sonner";
import { Conversation, ModelParameters, CustomInstructions, Memory } from "@/types";
import { downloadMarkdown } from "@/lib/export/markdown";
import { downloadJSON } from "@/lib/export/json";
import { downloadPDF } from "@/lib/export/pdf";
import { copyToClipboard } from "@/lib/export/clipboard";

export type ExportFormat = "markdown" | "json" | "pdf" | "clipboard";

export interface ExportOptions {
  includeMetadata?: boolean;
  includeTimestamps?: boolean;
  includeReasoning?: boolean;
  includeImages?: boolean;
  pretty?: boolean;
  modelParameters?: ModelParameters;
  customInstructions?: CustomInstructions;
  activeMemories?: Memory[];
}

export interface ExportProgress {
  isExporting: boolean;
  format?: ExportFormat;
  progress?: number;
  error?: string;
}

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress>({
    isExporting: false,
  });

  const exportConversation = async (
    conversation: Conversation,
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<void> => {
    if (!conversation || conversation.messages.length === 0) {
      toast.error("No conversation to export");
      return;
    }

    setProgress({ isExporting: true, format, progress: 0 });

    try {
      switch (format) {
        case "markdown":
          await exportMarkdown(conversation, options);
          break;
        case "json":
          await exportJSON(conversation, options);
          break;
        case "pdf":
          await exportPDF(conversation, options);
          break;
        case "clipboard":
          await exportClipboard(conversation, options);
          break;
        default:
          throw new Error(`Unknown export format: ${format}`);
      }

      setProgress({ isExporting: false });
      
      if (format !== "clipboard") {
        toast.success(`Conversation exported as ${format.toUpperCase()}`, {
          description: `"${conversation.title}" has been downloaded`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setProgress({ isExporting: false, error: errorMessage });
      toast.error(`Export failed`, {
        description: errorMessage,
      });
    }
  };

  const exportMarkdown = async (
    conversation: Conversation,
    options: ExportOptions
  ): Promise<void> => {
    setProgress((prev) => ({ ...prev, progress: 30 }));
    
    downloadMarkdown(conversation, {
      includeMetadata: options.includeMetadata ?? true,
      includeTimestamps: options.includeTimestamps ?? true,
      includeReasoning: options.includeReasoning ?? true,
      modelParameters: options.modelParameters,
    });
    
    setProgress((prev) => ({ ...prev, progress: 100 }));
  };

  const exportJSON = async (
    conversation: Conversation,
    options: ExportOptions
  ): Promise<void> => {
    setProgress((prev) => ({ ...prev, progress: 30 }));
    
    downloadJSON(
      conversation,
      {
        includeMetadata: options.includeMetadata ?? true,
        includeImages: options.includeImages ?? true,
        pretty: options.pretty ?? true,
      },
      {
        modelParameters: options.modelParameters,
        customInstructions: options.customInstructions,
        activeMemories: options.activeMemories,
      }
    );
    
    setProgress((prev) => ({ ...prev, progress: 100 }));
  };

  const exportPDF = async (
    conversation: Conversation,
    options: ExportOptions
  ): Promise<void> => {
    setProgress((prev) => ({ ...prev, progress: 20 }));
    
    await downloadPDF(conversation, {
      includeMetadata: options.includeMetadata ?? true,
      includeTimestamps: options.includeTimestamps ?? true,
      includeReasoning: options.includeReasoning ?? true,
      includeImages: options.includeImages ?? true,
      modelParameters: options.modelParameters,
    });
    
    setProgress((prev) => ({ ...prev, progress: 100 }));
  };

  const exportClipboard = async (
    conversation: Conversation,
    options: ExportOptions
  ): Promise<void> => {
    setProgress((prev) => ({ ...prev, progress: 50 }));
    
    await copyToClipboard(conversation, {
      format: "markdown",
      includeMetadata: options.includeMetadata ?? true,
      includeTimestamps: options.includeTimestamps ?? true,
      includeReasoning: options.includeReasoning ?? true,
      modelParameters: options.modelParameters,
    });
    
    setProgress((prev) => ({ ...prev, progress: 100 }));
    
    toast.success("Copied to clipboard", {
      description: "Conversation has been copied with formatting",
    });
  };

  const exportAll = async (
    conversation: Conversation,
    options: ExportOptions = {}
  ): Promise<void> => {
    const formats: ExportFormat[] = ["markdown", "json", "pdf"];
    
    for (const format of formats) {
      await exportConversation(conversation, format, options);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    toast.success("All exports completed", {
      description: `${formats.length} files have been downloaded`,
    });
  };

  return {
    exportConversation,
    exportAll,
    progress,
    isExporting: progress.isExporting,
  };
}
