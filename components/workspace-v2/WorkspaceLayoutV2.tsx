"use client";

import {
  type KeyboardEvent,
  type ClipboardEvent,
  type DragEventHandler,
  type Ref,
  type ReactNode,
  useCallback,
  useState,
} from "react";
import {
  Archive,
  Brain,
  ChevronDown,
  Download,
  FileText,
  Menu,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Paperclip,
  Send,
  Settings,
  ShieldCheck,
  Square,
  Upload,
  X,
  ClipboardList,
  LoaderCircle,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { cn } from "@/lib/utils";
import type { FileAttachment, ResponseMode } from "@/types";

interface WorkspaceFrameV2Props {
  sidebar: ReactNode;
  chat: ReactNode;
  composer: ReactNode;
  contextPanel: ReactNode;
  mobileSidebar: ReactNode;
  mobileContextPanel: ReactNode;
  activeConversationTitle: string;
  currentModelName: string;
  onOpenSettings: () => void;
  mobileContextOpen?: boolean;
  onMobileContextOpenChange?: (open: boolean) => void;
}

interface CommandComposerV2Props {
  value: string;
  placeholder: string;
  attachments: FileAttachment[];
  isLoading: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  speechSupported: boolean;
  speechStatusLabel: string;
  hasContent: boolean;
  modelName: string;
  reasoningLabel: string;
  hasReasoning: boolean;
  responseMode: ResponseMode;
  modelControl?: ReactNode;
  reasoningControl?: ReactNode;
  error?: string | null;
  speechError?: string | null;
  fileErrors?: string[];
  recordingDurationLabel?: string | null;
  onValueChange: (value: string) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onStop: () => void;
  onFileSelect: () => void;
  onMicrophoneClick: () => void;
  onToggleDocument: () => void;
  onToggleQuiz: () => void;
  onDragEnter?: DragEventHandler<HTMLDivElement>;
  onDragLeave?: DragEventHandler<HTMLDivElement>;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
  onRemoveAttachment?: (id: string) => void;
  isDragging?: boolean;
}

function IconButton({
  label,
  children,
  className,
  onClick,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "size-8 rounded-lg border border-white/8 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground",
            className
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ContextChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex max-w-[12rem] items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">
      <span className="text-foreground/65">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function WorkspaceFrameV2({
  sidebar,
  chat,
  composer,
  contextPanel,
  mobileSidebar,
  mobileContextPanel,
  activeConversationTitle,
  currentModelName,
  onOpenSettings,
  mobileContextOpen,
  onMobileContextOpenChange,
}: WorkspaceFrameV2Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [internalContextOpen, setInternalContextOpen] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const contextOpen = mobileContextOpen ?? internalContextOpen;
  const setContextOpen = onMobileContextOpenChange ?? setInternalContextOpen;
  const handleQuickExport = useCallback(() => {
    window.print();
  }, []);
  const handleFocusComposer = useCallback(() => {
    const composerInput = document.querySelector<HTMLTextAreaElement>("textarea");
    composerInput?.focus();
  }, []);

  return (
    <div className="relative h-dvh overflow-hidden bg-[var(--gc-bg)] text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[image:var(--gc-overlay-gradient)]"
      />
      <div className="relative z-10 flex h-full flex-col p-0 md:p-3">
        <div className="flex min-h-0 flex-1 overflow-hidden border border-[color:var(--gc-border)] bg-[var(--gc-surface-shell)] shadow-[0_24px_90px_rgba(0,0,0,0.22)] md:rounded-xl">
          <aside
            data-workspace-region="sidebar"
            className="hidden min-h-0 w-[17.5rem] shrink-0 overflow-hidden border-r border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] lg:block"
          >
            {sidebar}
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="shrink-0 border-b border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel-strong)] pt-[env(safe-area-inset-top)] md:pt-0">
              <div className="flex h-[3.1rem] items-center justify-between px-2.5 md:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <IconButton
                    label="Abrir conversas"
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden"
                  >
                    <Menu className="size-4" />
                  </IconButton>
                  <div className="hidden size-8 items-center justify-center rounded-lg border border-cyan-300/14 bg-cyan-300/8 md:flex">
                    <GPTLogo size={22} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-sm font-semibold text-foreground">
                        {activeConversationTitle}
                      </h1>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Gaucho Chat
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-medium text-emerald-200 lg:flex">
                    <ShieldCheck className="size-3.5" />
                    Salvo
                  </div>
                  <IconButton label="Exportar resposta" onClick={handleQuickExport}>
                    <Download className="size-4" />
                  </IconButton>
                  <IconButton label="Ajustar prompt" onClick={handleFocusComposer}>
                    <PencilLine className="size-4" />
                  </IconButton>
                  <IconButton label="Configurações" onClick={onOpenSettings}>
                    <Settings className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Painel contextual"
                    onClick={() => setContextOpen(true)}
                    className="xl:hidden"
                  >
                    <PanelRightOpen className="size-4" />
                  </IconButton>
                </div>
              </div>

              <div className="flex min-h-[2.2rem] items-center justify-between border-t border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2.5 py-1.5 md:px-4">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ContextChip label="Workspace" value="Anders" />
                  <ContextChip label="Modelo" value={currentModelName} />
                  <ContextChip label="Reasoning" value="Alto" />
                  <ContextChip label="Modo" value="Documento" />
                </div>
                <span className="hidden items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 sm:inline-flex">
                  <span className="size-1.5 rounded-full bg-cyan-200" />
                  online
                </span>
              </div>
            </header>

            <main data-workspace-region="chat" className="min-h-0 flex-1">
              {chat}
            </main>

            {composer}
          </div>

          <aside
            data-workspace-region="context"
            className={cn(
              "hidden min-h-0 shrink-0 overflow-hidden border-l border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] transition-[width] duration-200 xl:block",
              contextCollapsed
                ? "w-12"
                : contextExpanded
                ? "w-[34rem] 2xl:w-[40rem]"
                : "w-[22rem] 2xl:w-[24rem]"
            )}
          >
            {contextCollapsed ? (
              <div className="flex h-full flex-col items-center gap-3 py-3">
                <IconButton label="Abrir painel" onClick={() => setContextCollapsed(false)}>
                  <PanelRightOpen className="size-4" />
                </IconButton>
                <div className="h-px w-6 bg-white/10" />
                <span className="rotate-90 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Artefato
                </span>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex h-[3.25rem] items-center justify-between border-b border-white/8 px-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Painel operacional</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Canvas · artefato · atividade
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={contextExpanded ? "Reduzir canvas" : "Expandir canvas"}
                      onClick={() => setContextExpanded((current) => !current)}
                    >
                      {contextExpanded ? (
                        <Minimize2 className="size-4" />
                      ) : (
                        <Maximize2 className="size-4" />
                      )}
                    </IconButton>
                    <IconButton label="Recolher painel" onClick={() => setContextCollapsed(true)}>
                      <PanelRightClose className="size-4" />
                    </IconButton>
                  </div>
                </div>
                <div className="min-h-0 flex-1">{contextPanel}</div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[88vw] max-w-[20rem] gap-0 border-white/10 bg-[var(--gc-surface-panel)] p-0 pt-[env(safe-area-inset-top)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Conversas</SheetTitle>
            <SheetDescription>Navegação de conversas do Gaucho Chat.</SheetDescription>
          </SheetHeader>
          {mobileSidebar}
        </SheetContent>
      </Sheet>

      <Sheet open={contextOpen} onOpenChange={setContextOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[96vw] max-w-none gap-0 border-white/10 bg-[var(--gc-surface-panel)] p-0 pt-[env(safe-area-inset-top)] sm:max-w-[34rem]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Painel contextual</SheetTitle>
            <SheetDescription>Preview, fontes e raciocínio da conversa.</SheetDescription>
          </SheetHeader>
          {mobileContextPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CommandComposerV2({
  value,
  placeholder,
  attachments,
  isLoading,
  isProcessing,
  isRecording,
  isTranscribing,
  speechSupported,
  speechStatusLabel,
  hasContent,
  modelName,
  reasoningLabel,
  hasReasoning,
  responseMode,
  modelControl,
  reasoningControl,
  error,
  speechError,
  fileErrors = [],
  recordingDurationLabel,
  onValueChange,
  textareaRef,
  onKeyDown,
  onPaste,
  onSubmit,
  onStop,
  onFileSelect,
  onMicrophoneClick,
  onToggleDocument,
  onToggleQuiz,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onRemoveAttachment,
  isDragging = false,
}: CommandComposerV2Props) {
  const disabled = isLoading || isTranscribing;
  const statusMessage = error || speechError || fileErrors[0] || null;

  return (
    <footer className="shrink-0 border-t border-white/8 bg-[var(--gc-surface-panel-strong)] px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 md:px-4 md:pb-3">
      <div className="mx-auto max-w-5xl">
        {statusMessage && (
          <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {statusMessage}
          </div>
        )}

        <div
          className={cn(
            "relative overflow-hidden rounded-xl border border-white/10 bg-[var(--gc-surface-composer)] shadow-[0_18px_54px_rgba(0,0,0,0.28)] transition-colors",
            "focus-within:border-cyan-300/35",
            isDragging && "border-cyan-300/55 bg-cyan-300/8"
          )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
                <Upload className="size-4 animate-bounce" />
                Solte os arquivos aqui
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="max-h-[180px] min-h-[42px] w-full resize-none bg-transparent px-3 pb-1.5 pt-3 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/45 md:px-4 md:text-sm"
          />

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2 md:px-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.035] px-2 py-1.5 text-[11px]"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-300/10 text-cyan-100">
                    <FileText className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[8rem] truncate font-medium text-foreground/85">
                      {attachment.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatFileSize(attachment.size)}
                    </span>
                  </span>
                  {onRemoveAttachment && (
                    <button
                      type="button"
                      aria-label={`Remover ${attachment.name}`}
                      onClick={() => onRemoveAttachment(attachment.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 px-2 py-2 md:px-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || isProcessing}
                onClick={onFileSelect}
                aria-label="Adicionar arquivos"
                className="size-8 rounded-lg border border-white/8 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
              >
                {isProcessing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </Button>

              {modelControl ?? (
                <button
                  type="button"
                  className="flex h-8 max-w-[9rem] items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-2 text-[11px] font-medium text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                >
                  <span className="truncate">{modelName}</span>
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
              )}

              {hasReasoning && (
                reasoningControl ?? (
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-2 text-[11px] font-medium text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                  >
                    <Brain className="size-3.5" />
                    <span>{reasoningLabel}</span>
                  </button>
                )
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onToggleDocument}
                className={cn(
                  "h-8 rounded-lg border px-2 text-[11px]",
                  responseMode === "document"
                    ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100"
                    : "border-white/8 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                )}
              >
                <FileText className="mr-1 size-3.5" />
                Documento
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onToggleQuiz}
                className={cn(
                  "h-8 rounded-lg border px-2 text-[11px]",
                  responseMode === "quiz"
                    ? "border-amber-300/25 bg-amber-300/12 text-amber-100"
                    : "border-white/8 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                )}
              >
                <ClipboardList className="mr-1 size-3.5" />
                Quiz
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLoading || isTranscribing || (!speechSupported && !isRecording)}
                onClick={onMicrophoneClick}
                aria-label={isRecording ? "Encerrar gravação" : "Gravar áudio"}
                className={cn(
                  "h-8 rounded-lg border px-2 text-[11px]",
                  isRecording
                    ? "border-rose-300/25 bg-rose-300/12 text-rose-100"
                    : isTranscribing
                    ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-100"
                    : "border-white/8 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
                )}
              >
                {isTranscribing ? (
                  <LoaderCircle className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Mic className="mr-1 size-3.5" />
                )}
                <span className="hidden sm:inline">{speechStatusLabel}</span>
                {recordingDurationLabel && (
                  <span className="tabular-nums">{recordingDurationLabel}</span>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              {isLoading || isTranscribing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onStop}
                  aria-label="Parar geração"
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  <Square className="mr-1.5 size-3.5" />
                  Parar
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!hasContent || isRecording || isProcessing}
                  onClick={onSubmit}
                  aria-label="Enviar mensagem"
                  className="h-8 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-30"
                >
                  <Send className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-1.5 hidden items-center gap-2 text-[10px] text-muted-foreground/65 md:flex">
          <Archive className="size-3" />
          <span>Enter envia · Shift+Enter quebra linha · arraste arquivos ou cole imagens</span>
        </div>
      </div>
    </footer>
  );
}
