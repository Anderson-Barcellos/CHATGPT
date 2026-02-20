"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  FileJson,
  FileType,
  Copy,
  Download,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Conversation, ModelParameters } from "@/types";
import { useExport, ExportFormat } from "@/hooks/useExport";
import { useSettingsStore } from "@/stores/settingsStore";

interface ExportMenuProps {
  conversation: Conversation | null;
  disabled?: boolean;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportMenu({
  conversation,
  disabled = false,
  variant = "ghost",
  size = "sm",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const { exportConversation, exportAll, isExporting, progress } = useExport();
  const { getModelParameters, getCustomInstructions, getActiveMemories } =
    useSettingsStore();

  const handleExport = async (format: ExportFormat) => {
    if (!conversation) return;

    const modelParams = getModelParameters();
    const customInstructions = getCustomInstructions();
    const activeMemories = getActiveMemories();

    await exportConversation(conversation, format, {
      includeMetadata: true,
      includeTimestamps: true,
      includeReasoning: true,
      includeImages: true,
      pretty: true,
      modelParameters: modelParams,
      customInstructions: customInstructions ?? undefined,
      activeMemories: activeMemories,
    });

    setOpen(false);
  };

  const handleExportAll = async () => {
    if (!conversation) return;

    const modelParams = getModelParameters();
    const customInstructions = getCustomInstructions();
    const activeMemories = getActiveMemories();

    await exportAll(conversation, {
      includeMetadata: true,
      includeTimestamps: true,
      includeReasoning: true,
      includeImages: true,
      pretty: true,
      modelParameters: modelParams,
      customInstructions: customInstructions ?? undefined,
      activeMemories: activeMemories,
    });

    setOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "M") {
        e.preventDefault();
        handleExport("markdown");
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "J") {
        e.preventDefault();
        handleExport("json");
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        handleExport("pdf");
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        handleExport("clipboard");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [conversation]);

  const isDisabled = disabled || !conversation || conversation.messages.length === 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isDisabled} className={size === "icon" ? "h-8 w-8" : ""}>
          {isExporting ? (
            <Loader2 className={`h-4 w-4 animate-spin ${size !== "icon" ? "mr-2" : ""}`} />
          ) : (
            <Download className={`h-4 w-4 ${size !== "icon" ? "mr-2" : ""}`} />
          )}
          {size !== "icon" && (isExporting ? "Exporting..." : "Export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Conversation</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport("markdown")}
          disabled={isExporting}
        >
          <FileText className="h-4 w-4 mr-2" />
          Markdown (.md)
          <DropdownMenuShortcut>⇧⌘M</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport("json")}
          disabled={isExporting}
        >
          <FileJson className="h-4 w-4 mr-2" />
          JSON (.json)
          <DropdownMenuShortcut>⇧⌘J</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
        >
          <FileType className="h-4 w-4 mr-2" />
          PDF (.pdf)
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleExport("clipboard")}
          disabled={isExporting}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to Clipboard
          <DropdownMenuShortcut>⇧⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleExportAll} disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Export All Formats
        </DropdownMenuItem>

        {isExporting && progress.progress !== undefined && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between mb-1">
                <span>Progress</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ExportButton({
  conversation,
  format,
  disabled = false,
}: {
  conversation: Conversation | null;
  format: ExportFormat;
  disabled?: boolean;
}) {
  const { exportConversation, isExporting } = useExport();
  const { getModelParameters } = useSettingsStore();

  const handleExport = async () => {
    if (!conversation) return;

    const modelParams = getModelParameters();

    await exportConversation(conversation, format, {
      includeMetadata: true,
      includeTimestamps: true,
      includeReasoning: true,
      includeImages: true,
      modelParameters: modelParams,
    });
  };

  const icons = {
    markdown: FileText,
    json: FileJson,
    pdf: FileType,
    clipboard: Copy,
  };

  const Icon = icons[format];

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={disabled || isExporting || !conversation}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {format.charAt(0).toUpperCase() + format.slice(1)}
    </Button>
  );
}
