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
  Ellipsis,
  FileText,
  Menu,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Paperclip,
  Search,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FadeIn } from "@/components/motion/FadeIn";
import { SlideIn } from "@/components/motion/SlideIn";
import { GPTLogo } from "@/components/ui/gpt-logo";
import { useCommandPaletteContext } from "@/components/command/CommandPaletteProvider";
import { cn } from "@/lib/utils";
import type { FileAttachment, ResponseMode } from "@/types";

const RESPONSE_MODE_LABELS: Record<ResponseMode, string> = {
  default: "Chat",
  document: "Documento",
  deepsearch_medium: "Deepsearch Medium",
  deepsearch_high: "Deepsearch High",
  quiz: "Quiz",
};

interface WorkspaceFrameV2Props {
  sidebar: ReactNode;
  chat: ReactNode;
  composer: ReactNode;
  contextPanel: ReactNode;
  mobileSidebar: ReactNode;
  mobileContextPanel: ReactNode;
  tabletSidebar?: ReactNode;
  activeConversationTitle: string;
  currentModelName: string;
  onOpenSettings: () => void;
  exportControl?: ReactNode;
  activeResponseMode?: ResponseMode;
  reasoningLabel?: string;
  artifactCount?: number;
  mobileSidebarOpen?: boolean;
  onMobileSidebarOpenChange?: (open: boolean) => void;
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
  audioLevel?: number;
  speechSupported: boolean;
  speechStatusLabel: string;
  hasContent: boolean;
  modelName: string;
  reasoningLabel: string;
  hasReasoning: boolean;
  responseMode: ResponseMode;
  modelControl?: ReactNode;
  reasoningControl?: ReactNode;
  costControl?: ReactNode;
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
  onSelectDocumentMode: (mode: Extract<ResponseMode, "document" | "deepsearch_medium" | "deepsearch_high">) => void;
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
            "gc-clinical-input-surface size-[var(--gc-mobile-icon-button-size)] rounded-lg border border-[color:var(--gc-border-soft)] text-muted-foreground shadow-[0_1px_4px_rgba(15,23,42,0.05)] hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground md:size-8",
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
    <span className="gc-clinical-card inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-[color:var(--gc-border-soft)] px-2.5 py-1 text-nano text-muted-foreground">
      <span className="text-foreground/55">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const COMPOSER_CONTROL_BUTTON_CLASS =
  "border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground";

export function WorkspaceFrameV2({
  sidebar,
  chat,
  composer,
  contextPanel,
  mobileSidebar,
  mobileContextPanel,
  tabletSidebar,
  activeConversationTitle,
  currentModelName,
  onOpenSettings,
  exportControl,
  activeResponseMode,
  reasoningLabel,
  artifactCount,
  mobileSidebarOpen,
  onMobileSidebarOpenChange,
  mobileContextOpen,
  onMobileContextOpenChange,
}: WorkspaceFrameV2Props) {
  const { setOpen: openCommandPalette } = useCommandPaletteContext();
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const sidebarOpen = mobileSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = onMobileSidebarOpenChange ?? setInternalSidebarOpen;
  const [internalContextOpen, setInternalContextOpen] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const contextOpen = mobileContextOpen ?? internalContextOpen;
  const setContextOpen = onMobileContextOpenChange ?? setInternalContextOpen;
  const handleFocusComposer = useCallback(() => {
    const composerInput = document.querySelector<HTMLTextAreaElement>("textarea");
    composerInput?.focus();
  }, []);

  return (
    <div className="gc-dynamic-bg gc-device-frame gc-mobile-density relative overflow-hidden text-foreground">
      <div
        aria-hidden="true"
        className="gc-ambient-overlay pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="gc-subtle-grid pointer-events-none absolute inset-0 opacity-35"
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="gc-clinical-shell flex min-h-0 flex-1 overflow-hidden backdrop-blur-xl">
          <aside
            data-workspace-region="sidebar"
            className="gc-clinical-rail hidden min-h-0 w-[19rem] shrink-0 overflow-hidden border-r border-[color:var(--gc-border)] lg:block"
          >
            <FadeIn duration={0.24} className="h-full">
              {sidebar}
            </FadeIn>
          </aside>

          {tabletSidebar && (
            <aside
              data-workspace-region="tablet-rail"
              className="gc-clinical-rail hidden min-h-0 w-12 shrink-0 overflow-hidden border-r border-[color:var(--gc-border)] md:block lg:hidden"
            >
              <FadeIn duration={0.24} className="h-full">
                {tabletSidebar}
              </FadeIn>
            </aside>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="gc-clinical-header shrink-0 border-b border-[color:var(--gc-border-soft)] gc-safe-top md:border-[color:var(--gc-border)] md:pt-0">
              <div className="flex h-[var(--gc-mobile-header-height)] items-center justify-between px-[var(--gc-mobile-header-x)] md:h-[3.45rem] md:px-5">
                <div className="flex min-w-0 items-center gap-1 md:gap-2">
                  <IconButton
                    label="Abrir conversas"
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden"
                  >
                    <Menu className="size-4" />
                  </IconButton>
                  <div className="hidden size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/12 shadow-[0_8px_22px_rgba(15,118,110,0.12)] md:flex">
                    <GPTLogo size={22} />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-[0.84rem] font-semibold tracking-[-0.02em] text-foreground md:text-[0.96rem]">
                        {activeConversationTitle}
                      </h1>
                    </div>
                    <p className="truncate text-[9px] text-muted-foreground/72 md:text-micro">
                      Gaucho Chat
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 md:gap-1.5">
                  <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-nano font-semibold text-emerald-700 dark:text-emerald-300 lg:flex">
                    <ShieldCheck className="size-3.5" />
                    Salvo
                  </div>
                  {exportControl ?? null}
                  <IconButton
                    label="Buscar comandos"
                    onClick={() => openCommandPalette(true)}
                    className="hidden md:inline-flex xl:hidden"
                  >
                    <Search className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Ajustar prompt"
                    onClick={handleFocusComposer}
                    className="hidden sm:inline-flex"
                  >
                    <PencilLine className="size-4" />
                  </IconButton>
                  <IconButton label="Configurações" onClick={onOpenSettings}>
                    <Settings className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Painel contextual"
                    onClick={() => setContextOpen(!contextOpen)}
                    className="relative xl:hidden"
                  >
                    <PanelRightOpen className="size-4" />
                    {!!artifactCount && artifactCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold leading-none text-primary-foreground">
                        {artifactCount > 9 ? "9+" : artifactCount}
                      </span>
                    )}
                  </IconButton>
                </div>
              </div>

              <div className="gc-clinical-subheader flex min-h-[var(--gc-mobile-subheader-height)] items-center justify-between border-t border-[color:var(--gc-border-soft)] px-[var(--gc-mobile-subheader-x)] py-[var(--gc-mobile-subheader-y)] md:min-h-[2.35rem] md:px-5 md:py-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex">
                    <ContextChip label="Workspace" value="Anders" />
                    <ContextChip label="Modelo" value={currentModelName} />
                    {reasoningLabel && reasoningLabel !== "—" && (
                      <ContextChip label="Reasoning" value={reasoningLabel} />
                    )}
                    <ContextChip
                      label="Modo"
                      value={RESPONSE_MODE_LABELS[activeResponseMode ?? "default"]}
                    />
                  </div>
                  <span className="inline-flex md:hidden items-center gap-1 truncate text-[9px] text-muted-foreground/88">
                    <span className="font-medium text-foreground truncate max-w-[6.25rem]">{currentModelName}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{RESPONSE_MODE_LABELS[activeResponseMode ?? "default"]}</span>
                    {reasoningLabel && reasoningLabel !== "—" && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="truncate max-w-[3.25rem]">{reasoningLabel}</span>
                      </>
                    )}
                  </span>
                </div>
                <span className="hidden items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-nano font-medium text-emerald-700 dark:text-emerald-300 md:inline-flex">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  online
                </span>
              </div>
            </header>

            <main data-workspace-region="chat" className="min-h-0 flex-1">
              <FadeIn delay={0.04} duration={0.24} className="h-full">
                {chat}
              </FadeIn>
            </main>

            {composer ? (
              <SlideIn from="bottom" distance={10} duration={0.24}>
                {composer}
              </SlideIn>
            ) : null}
          </div>

            <aside
              data-workspace-region="context"
              className={cn(
                "gc-clinical-panel hidden min-h-0 shrink-0 overflow-hidden border-l border-[color:var(--gc-border)] transition-[width] duration-200 xl:block",
                contextCollapsed
                  ? "w-12"
                  : contextExpanded
                  ? "w-[31rem] 2xl:w-[37rem]"
                  : "w-[23rem] 2xl:w-[29rem]"
              )}
            >
            {contextCollapsed ? (
              <div className="flex h-full flex-col items-center gap-3 py-3">
                <IconButton label="Abrir painel" onClick={() => setContextCollapsed(false)}>
                  <PanelRightOpen className="size-4" />
                </IconButton>
                <div className="h-px w-6 bg-[var(--gc-border-soft)]" />
                <span className="rotate-90 whitespace-nowrap text-nano font-medium uppercase tracking-eyebrow text-muted-foreground">
                  Artefato
                </span>
              </div>
            ) : (
                <div className="flex h-full flex-col">
                  <div className="gc-clinical-section-header flex h-[3.45rem] items-center justify-between border-b border-[color:var(--gc-border)] px-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Painel operacional</p>
                      <p className="text-nano uppercase tracking-label text-muted-foreground">
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
                <div className="min-h-0 flex-1">
                  <SlideIn from="right" distance={12} duration={0.24} className="h-full">
                    {contextPanel}
                  </SlideIn>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="gc-clinical-rail w-[92vw] max-w-[20rem] gap-0 border-[color:var(--gc-border)] p-0 gc-safe-top"
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
          className="gc-clinical-panel w-[100vw] max-w-none gap-0 border-0 p-0 gc-safe-top sm:w-[96vw] sm:border sm:border-[color:var(--gc-border)] sm:max-w-[34rem]"
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
  audioLevel = 0,
  speechSupported,
  speechStatusLabel,
  hasContent,
  modelName,
  hasReasoning,
  responseMode,
  modelControl,
  reasoningControl,
  costControl,
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
  onSelectDocumentMode,
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
    <footer className="gc-clinical-section-header shrink-0 border-t border-[color:var(--gc-border)] px-[var(--gc-mobile-composer-footer-x)] pb-[calc(env(safe-area-inset-bottom)+var(--gc-mobile-composer-footer-bottom))] pt-[var(--gc-mobile-composer-footer-top)] md:px-4 md:pb-3 md:pt-2.5">
      <div className="mx-auto max-w-[62rem]">
        {statusMessage && (
          <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {statusMessage}
          </div>
        )}

        <div
            className={cn(
              "gc-clinical-composer relative overflow-hidden rounded-[var(--gc-mobile-composer-radius)] border transition-colors md:rounded-2xl",
              "focus-within:border-primary/35 focus-within:shadow-[0_16px_40px_rgba(14,116,144,0.12)]",
              isDragging && "border-primary/55 bg-primary/8"
            )}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
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
            className="max-h-[var(--gc-mobile-textarea-max-height)] min-h-[var(--gc-mobile-textarea-min-height)] w-full resize-none bg-transparent px-[var(--gc-mobile-textarea-px)] pb-[var(--gc-mobile-textarea-pb)] pt-[var(--gc-mobile-textarea-pt)] text-[var(--gc-mobile-textarea-font-size)] leading-relaxed outline-none placeholder:text-muted-foreground/45 md:min-h-[46px] md:px-4 md:pb-2 md:pt-3.5 md:text-sm"
          />

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2 md:px-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2 py-1.5 text-micro"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[8rem] truncate font-medium text-foreground/85">
                      {attachment.name}
                    </span>
                    <span className="block text-nano text-muted-foreground">
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

          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)]/70 px-1.5 py-1.5 md:gap-2 md:px-3 md:py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1 md:gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || isProcessing}
                onClick={onFileSelect}
                aria-label="Adicionar arquivos"
                    className={cn("size-[var(--gc-mobile-control-height)] rounded-lg md:size-8", COMPOSER_CONTROL_BUTTON_CLASS)}
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
                  className={cn(
                    "flex h-[var(--gc-mobile-control-height)] max-w-[6rem] items-center gap-1 rounded-lg px-1.5 text-[var(--gc-mobile-control-font-size)] font-medium md:h-8 md:max-w-[6.5rem] md:text-nano",
                    COMPOSER_CONTROL_BUTTON_CLASS
                  )}
                >
                  <span className="truncate">{modelName}</span>
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
              )}

              {hasReasoning && (
                reasoningControl ?? (
                  <button
                    type="button"
                    aria-label="Ajustar nível de raciocínio"
                    className={cn(
                      "flex h-[var(--gc-mobile-control-height)] items-center rounded-lg px-1.5 md:h-8",
                      COMPOSER_CONTROL_BUTTON_CLASS
                    )}
                  >
                    <Brain className="size-3.5" />
                  </button>
                )
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className={cn(
                      "hidden h-8 rounded-lg border px-2 text-micro md:flex",
                      responseMode === "document" ||
                        responseMode === "deepsearch_medium" ||
                        responseMode === "deepsearch_high"
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : COMPOSER_CONTROL_BUTTON_CLASS
                    )}
                  >
                    <FileText className="mr-1 size-3.5" />
                    Documento
                    <ChevronDown className="ml-1 size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="min-w-[14rem]">
                  <DropdownMenuItem onClick={() => onSelectDocumentMode("deepsearch_medium")}>
                    <FileText
                      className={cn(
                        "mr-2 size-3.5",
                        responseMode === "deepsearch_medium" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className={responseMode === "deepsearch_medium" ? "text-primary" : ""}>
                      Deepsearch Medium
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSelectDocumentMode("deepsearch_high")}>
                    <FileText
                      className={cn(
                        "mr-2 size-3.5",
                        responseMode === "deepsearch_high" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className={responseMode === "deepsearch_high" ? "text-primary" : ""}>
                      Deepsearch High
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onToggleQuiz}
                  className={cn(
                    "hidden h-8 rounded-lg border px-2 text-micro md:flex",
                    responseMode === "quiz"
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : COMPOSER_CONTROL_BUTTON_CLASS
                  )}
                >
                <ClipboardList className="mr-1 size-3.5" />
                Quiz
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    className={cn(
                      "size-[var(--gc-mobile-control-height)] rounded-lg md:hidden",
                      COMPOSER_CONTROL_BUTTON_CLASS
                    )}
                    aria-label="Mais opções"
                  >
                    <Ellipsis className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="min-w-[10rem]">
                  <DropdownMenuItem onClick={() => onSelectDocumentMode("deepsearch_medium")}>
                    <FileText
                      className={cn(
                        "mr-2 size-3.5",
                        responseMode === "deepsearch_medium" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className={responseMode === "deepsearch_medium" ? "text-primary" : ""}>
                      Deepsearch Medium
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSelectDocumentMode("deepsearch_high")}>
                    <FileText
                      className={cn(
                        "mr-2 size-3.5",
                        responseMode === "deepsearch_high" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className={responseMode === "deepsearch_high" ? "text-primary" : ""}>
                      Deepsearch High
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleQuiz}>
                    <ClipboardList
                      className={cn(
                        "mr-2 size-3.5",
                        responseMode === "quiz" ? "text-amber-300" : "text-muted-foreground"
                      )}
                    />
                    <span className={responseMode === "quiz" ? "text-amber-100" : ""}>
                      Quiz
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLoading || isTranscribing || (!speechSupported && !isRecording)}
                onClick={onMicrophoneClick}
                aria-label={isRecording ? "Encerrar gravação" : "Gravar áudio"}
                style={isRecording ? {
                  boxShadow: `0 0 ${8 + audioLevel * 14}px rgba(251,113,133,${(0.3 + audioLevel * 0.6).toFixed(2)})`,
                } : undefined}
                  className={cn(
                    "h-[var(--gc-mobile-control-height)] rounded-lg border px-2 text-[var(--gc-mobile-control-font-size)] transition-shadow md:h-8 md:text-micro",
                  isRecording
                    ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : isTranscribing
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : COMPOSER_CONTROL_BUTTON_CLASS
                )}
              >
                {isTranscribing ? (
                  <LoaderCircle className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Mic className={cn("mr-1 size-3.5", isRecording && "animate-pulse")} />
                )}
                <span className="hidden sm:inline">{speechStatusLabel}</span>
                {recordingDurationLabel && (
                  <span className="tabular-nums">{recordingDurationLabel}</span>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-1 md:gap-1.5">
              {costControl}
              {isLoading || isTranscribing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onStop}
                  aria-label="Parar geração"
                  className="h-[var(--gc-mobile-control-height)] rounded-lg px-2.5 text-[var(--gc-mobile-send-font-size)] md:h-8 md:px-3 md:text-xs"
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
                  className="h-[var(--gc-mobile-control-height)] rounded-lg bg-primary px-2.5 text-[var(--gc-mobile-send-font-size)] font-semibold text-primary-foreground shadow-[0_8px_18px_rgba(15,118,110,0.18)] hover:bg-primary/90 disabled:opacity-30 md:h-8 md:px-3 md:text-xs"
                >
                  <Send className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-1.5 hidden items-center gap-2 text-nano text-muted-foreground/65 md:flex">
          <Archive className="size-3" />
          <span>Enter envia · Shift+Enter quebra linha · arraste arquivos ou cole imagens</span>
        </div>
      </div>
    </footer>
  );
}
