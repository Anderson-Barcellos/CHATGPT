"use client";

import { useMemo } from "react";
import { Copy, Download, FileJson, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExport } from "@/hooks/useExport";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/stores/chatStore";

export function ExportDropdown() {
  const { exportConversation, progress } = useExport();
  const { activeConversationId, messages } = useChatStore();
  const { conversations } = useConversations();

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    const found = conversations.find((c) => c.id === activeConversationId);
    return found
      ? { ...found, messages }
      : { id: activeConversationId, title: "Workspace", messages, createdAt: new Date(), updatedAt: new Date() };
  }, [activeConversationId, conversations, messages]);

  const disabled = !activeConversation || progress.isExporting;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Exportar conversa"
              disabled={disabled}
              className="size-8 rounded-lg border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground disabled:opacity-40"
            >
              {progress.isExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Exportar conversa</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={() => activeConversation && exportConversation(activeConversation, "markdown")}
        >
          <FileText className="mr-2 size-4" />
          Markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => activeConversation && exportConversation(activeConversation, "json")}
        >
          <FileJson className="mr-2 size-4" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => activeConversation && exportConversation(activeConversation, "pdf")}
        >
          <Download className="mr-2 size-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => activeConversation && exportConversation(activeConversation, "clipboard")}
        >
          <Copy className="mr-2 size-4" />
          Copiar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
