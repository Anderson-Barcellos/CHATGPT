"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState, DragEvent, ClipboardEvent } from "react";
import { useChat } from "@/hooks/useChat";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { useSettingsStore } from "@/stores/settingsStore";
import { MODELS, isReasoningModel as checkReasoning, getChatModels } from "@/lib/models/modelConfig";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  Square,
  Brain,
  ChevronDown,
  FileText,
  Mic,
  LoaderCircle,
  Paperclip,
  X,
  FileIcon,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReasoningEffort } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const REASONING_OPTIONS: { value: ReasoningEffort; label: string; desc: string }[] = [
  { value: "none", label: "Sem", desc: "Resposta direta" },
  { value: "low", label: "Baixo", desc: "Raciocinio leve" },
  { value: "medium", label: "Medio", desc: "Equilibrado" },
  { value: "high", label: "Alto", desc: "Raciocinio profundo" },
  { value: "xhigh", label: "Maximo", desc: "Analise exaustiva" },
];

function formatRecordingDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function InputArea() {
  const [input, setInput] = useState("");
  const [documentMode, setDocumentMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, stopGeneration, isLoading, error } = useChat();
  const { attachments, isProcessing, errors: fileErrors, addFiles, removeFile, clearFiles } = useFileAttachments();
  const {
    audioLevel,
    error: speechError,
    isSupported: speechSupported,
    recordingDurationMs,
    status: speechStatus,
    toggleRecording,
  } = useSpeechToText();
  const { parameters, updateParameters } = useSettingsStore();

  const modelList = useMemo(() => getChatModels(), []);

  const hasReasoning = useMemo(() => {
    return checkReasoning(parameters.model);
  }, [parameters.model]);

  const currentModel = MODELS[parameters.model];
  const currentReasoning = REASONING_OPTIONS.find((r) => r.value === parameters.reasoningEffort);
  const isRecording = speechStatus === "recording";
  const isTranscribing = speechStatus === "transcribing";
  const disabled = isLoading || isTranscribing;
  const hasContent = input.trim().length > 0 || attachments.length > 0;

  const audioMeterBars = useMemo(() => {
    return Array.from({ length: 16 }, (_, index) => {
      if (isTranscribing) return 0.28 + ((index + 1) % 5) * 0.12;
      if (isRecording) {
        const sway = 0.74 + Math.sin(index * 0.8) * 0.18;
        return Math.max(0.16, Math.min(1, audioLevel * sway + 0.12));
      }
      return 0.1;
    });
  }, [audioLevel, isRecording, isTranscribing]);

  const speechStatusLabel = useMemo(() => {
    if (isRecording) return "Gravando";
    if (isTranscribing) return "Transcrevendo";
    if (speechStatus === "error") return "Falha";
    return "Voz";
  }, [isRecording, isTranscribing, speechStatus]);

  const speechHint = useMemo(() => {
    if (isRecording) return "Toque no microfone de novo para encerrar e transcrever.";
    if (isTranscribing) return "Convertendo teu áudio em texto...";
    if (!speechSupported) return "Este navegador não oferece suporte completo para gravação.";
    return null;
  }, [isRecording, isTranscribing, speechSupported]);

  const handleModelChange = useCallback((newModel: string) => {
    updateParameters({ model: newModel });
  }, [updateParameters]);

  const handleSubmit = useCallback(async () => {
    if (!hasContent) return;
    const sent = await sendMessage(input, { documentMode, attachments: attachments.length > 0 ? attachments : undefined });
    if (sent) {
      setInput("");
      setDocumentMode(false);
      clearFiles();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      textareaRef.current?.focus();
    }
  }, [attachments, clearFiles, documentMode, hasContent, input, sendMessage]);

  const handleMicrophoneClick = useCallback(async () => {
    const transcript = await toggleRecording();
    if (!transcript) return;
    setInput((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent) return transcript;
      return `${current}${current.endsWith("\n") ? "" : "\n"}${transcript}`;
    });
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        textareaRef.current.focus();
      }
    });
  }, [toggleRecording]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }, [addFiles]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  }, [addFiles]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handleFocus = () => {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 350);
    };
    el.addEventListener("focus", handleFocus);
    return () => el.removeEventListener("focus", handleFocus);
  }, []);

  return (
    <div className="border-t border-white/5 bg-background/40 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] md:pb-0">
      <div className="mx-auto w-full max-w-5xl px-3 py-3 md:px-4 md:py-4">
        {error && (
          <Alert variant="destructive" className="mb-1.5 md:mb-2">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {speechError && !error && (
          <Alert variant="destructive" className="mb-1.5 md:mb-2">
            <AlertDescription className="text-xs">{speechError}</AlertDescription>
          </Alert>
        )}
        {fileErrors.length > 0 && (
          <Alert variant="destructive" className="mb-1.5 md:mb-2">
            <AlertDescription className="text-xs">
              {fileErrors.map((e) => `${e.fileName}: ${e.error}`).join(" | ")}
            </AlertDescription>
          </Alert>
        )}
        {documentMode && (
          <Alert className="mb-1.5 border-cyan-500/20 bg-cyan-500/8 text-cyan-50 md:mb-2">
            <AlertDescription className="text-xs text-foreground/80">
              O modelo vai responder em formato de documento pronto para leitura e exportação.
            </AlertDescription>
          </Alert>
        )}

        <div
          className={cn(
            "relative rounded-xl border border-white/10 bg-background/70 shadow-lg backdrop-blur-xl md:rounded-2xl",
            "transition-all duration-200",
            "focus-within:shadow-xl focus-within:border-primary/30",
            isDragging && "border-primary/50 shadow-xl shadow-primary/10 bg-primary/5"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary/8 backdrop-blur-sm border-2 border-dashed border-primary/40">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-8 w-8 animate-bounce" />
                <span className="text-sm font-medium">Solte os arquivos aqui</span>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json,.xml,.log,.yaml,.yml,.toml,.ini,.sh,.py,.js,.ts,.tsx,.jsx,.html,.css"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isRecording
                ? "Gravando teu audio..."
                : documentMode
                ? "Descreva o documento que tu quer elaborar..."
                : attachments.length > 0
                ? "Adicione uma mensagem sobre os arquivos..."
                : "Mensagem para o GPT..."
            }
            className={cn(
              "w-full resize-none bg-transparent px-3 pt-2.5 pb-1.5 text-[13px] md:px-4 md:pt-3 md:pb-2 md:text-sm",
              "outline-none placeholder:text-muted-foreground/50",
              "min-h-[40px] max-h-[200px] md:min-h-[44px]"
            )}
            rows={1}
            disabled={disabled}
          />

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pb-2 md:gap-2 md:px-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group relative flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] transition-colors hover:bg-white/10 md:gap-2 md:rounded-xl md:px-2.5 md:text-xs"
                >
                  {att.type === "image" && att.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- thumbnail data URI */
                    <img
                      src={att.thumbnailUrl}
                      alt={att.name}
                      className="h-7 w-7 rounded-lg object-cover md:h-8 md:w-8"
                    />
                  ) : att.type === "pdf" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 md:h-8 md:w-8">
                      <FileIcon className="h-4 w-4 text-rose-400" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 md:h-8 md:w-8">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                  )}
                  <div className="min-w-0 max-w-[120px]">
                    <p className="truncate font-medium text-foreground/80">{att.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{formatFileSize(att.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(att.id)}
                    className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-muted-foreground md:rounded-xl md:px-3 md:py-2 md:text-xs">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Processando...
                </div>
              )}
            </div>
          )}

          {(isRecording || isTranscribing) && (
            <div className="px-3 pb-2 md:px-4">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 md:gap-3 md:rounded-2xl md:px-3 md:py-2.5">
                <div className="flex h-6 items-end gap-1 md:h-7">
                  {audioMeterBars.map((bar, index) => (
                    <span
                      key={index}
                      className={cn(
                        "w-1 rounded-full transition-[height,opacity,background-color] duration-150",
                        isRecording ? "bg-rose-400/85" : "bg-cyan-400/85",
                        isTranscribing && "animate-pulse"
                      )}
                      style={{
                        height: `${Math.max(5, Math.round(bar * 22))}px`,
                        opacity: isTranscribing ? 0.75 : 0.35 + bar * 0.65,
                      }}
                    />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] md:text-[10px] md:tracking-[0.16em]",
                        isRecording
                          ? "bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/30"
                          : "bg-cyan-500/12 text-cyan-100 ring-1 ring-cyan-400/25"
                      )}
                    >
                      {speechStatusLabel}
                    </span>
                    {isRecording && (
                      <span className="text-[10px] font-medium tabular-nums text-foreground/80 md:text-[11px]">
                        {formatRecordingDuration(recordingDurationMs)}
                      </span>
                    )}
                  </div>
                  {speechHint && (
                    <div className="mt-1 text-[10px] text-muted-foreground md:text-[11px]">
                      {speechHint}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-1 px-2 pb-2 md:gap-2 md:px-3 md:pb-3">
            <div className="flex flex-wrap items-center gap-0.5 md:gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || isProcessing}
                onClick={handleFileSelect}
                aria-label="Adicionar arquivos"
                className={cn(
                  "h-6 w-6 rounded-full text-muted-foreground hover:text-foreground md:h-7 md:w-7",
                  attachments.length > 0
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/20"
                    : "bg-white/5"
                )}
              >
                {isProcessing ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label="Selecionar modelo"
                    className="h-6 gap-0.5 rounded-full px-2 text-[9px] font-medium text-muted-foreground hover:text-foreground bg-white/5 md:h-7 md:gap-1 md:px-3 md:text-[11px]"
                  >
                    <span className="max-w-[72px] truncate md:max-w-[100px]">{currentModel?.name || parameters.model}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Modelo</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {modelList.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => handleModelChange(model.id)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 py-2",
                        parameters.model === model.id && "bg-primary/10"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-medium text-xs">{model.name}</span>
                        {model.badge && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                            {model.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                        {model.description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasReasoning && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      aria-label="Ajustar nível de raciocínio"
                      className="h-6 gap-0.5 rounded-full px-2 text-[9px] font-medium text-muted-foreground hover:text-foreground bg-white/5 md:h-7 md:gap-1 md:px-3 md:text-[11px]"
                    >
                      <Brain className="h-2.5 w-2.5 md:h-3 md:w-3" />
                      <span>{currentReasoning?.label || "Medio"}</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Raciocinio</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {REASONING_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => updateParameters({ reasoningEffort: opt.value })}
                        className={cn(
                          "flex flex-col items-start gap-0.5",
                          parameters.reasoningEffort === opt.value && "bg-primary/10"
                        )}
                      >
                        <span className="font-medium text-xs">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => setDocumentMode((current) => !current)}
                aria-label="Alternar modo documento"
                className={cn(
                  "h-6 gap-0.5 rounded-full px-2 text-[9px] font-medium transition-colors md:h-7 md:gap-1 md:px-3 md:text-[11px]",
                  documentMode
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/30 hover:bg-cyan-500/20"
                    : "bg-white/5 text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="h-2.5 w-2.5 md:h-3 md:w-3" />
                <span className="hidden sm:inline">Documento</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLoading || isTranscribing || (!speechSupported && !isRecording)}
                onClick={handleMicrophoneClick}
                aria-label={isRecording ? "Encerrar gravação" : "Gravar áudio"}
                className={cn(
                  "h-6 gap-0.5 rounded-full px-2 text-[9px] font-medium transition-colors md:h-7 md:gap-1 md:px-3 md:text-[11px]",
                  isRecording
                    ? "bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/30 hover:bg-rose-500/20"
                    : isTranscribing
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/30 hover:bg-cyan-500/20"
                    : speechStatus === "error"
                    ? "bg-amber-500/12 text-amber-100 ring-1 ring-amber-400/25 hover:bg-amber-500/18"
                    : "bg-white/5 text-muted-foreground hover:text-foreground"
                )}
              >
                {isTranscribing ? (
                  <LoaderCircle className="h-2.5 w-2.5 animate-spin md:h-3 md:w-3" />
                ) : (
                  <Mic className="h-2.5 w-2.5 md:h-3 md:w-3" />
                )}
                <span className="hidden sm:inline">{speechStatusLabel}</span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              {disabled ? (
                <Button
                  onClick={stopGeneration}
                  variant="destructive"
                  size="sm"
                  aria-label="Parar geração"
                  className="h-7 rounded-lg px-2 text-[10px] md:h-9 md:rounded-xl md:px-3 md:text-xs"
                >
                  <Square className="mr-1.5 h-3.5 w-3.5" />
                  Parar
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  size="sm"
                  disabled={!hasContent || isRecording || isProcessing}
                  aria-label="Enviar mensagem"
                  className={cn(
                    "h-7 rounded-lg px-2.5 text-[10px] md:h-9 md:rounded-xl md:px-4 md:text-xs",
                    "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-600 hover:via-blue-700 hover:to-indigo-700 text-white",
                    "disabled:opacity-30"
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-1 text-center text-[9px] text-muted-foreground/50 md:mt-1.5 md:text-[10px]">
          Enter para enviar · Shift+Enter para nova linha · Arraste arquivos ou cole imagens
        </p>
      </div>
    </div>
  );
}
