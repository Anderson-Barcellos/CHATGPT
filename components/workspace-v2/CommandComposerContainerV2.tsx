"use client";

import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Brain,
  ChevronDown,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandComposerV2 } from "@/components/workspace-v2/WorkspaceLayoutV2";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import {
  getChatModels,
  getSupportedReasoningEfforts,
  isDeepSeekModel,
  isReasoningModel as checkReasoning,
  MODELS,
  modelSupportsReasoningMode,
} from "@/lib/models/modelConfig";
import { canSubmitComposerMessage } from "@/lib/chat/composerSubmit";
import {
  QUIZ_FORCED_MODEL,
  QUIZ_FORCED_REASONING_EFFORT,
  QUIZ_MIN_QUESTION_COUNT,
} from "@/lib/artifacts/quizArtifacts";
import { cn } from "@/lib/utils";
import type { ReasoningEffort, ResponseMode, SendMessageOptions } from "@/types";

const REASONING_OPTIONS: { value: ReasoningEffort; label: string; desc: string }[] = [
  { value: "none", label: "Sem", desc: "Resposta direta" },
  { value: "low", label: "Baixo", desc: "Raciocinio leve" },
  { value: "medium", label: "Medio", desc: "Equilibrado" },
  { value: "high", label: "Alto", desc: "Raciocinio profundo" },
  { value: "xhigh", label: "Muito alto", desc: "Analise exaustiva" },
  { value: "max", label: "Maximo", desc: "Qualidade extrema" },
];

const IMAGE_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const FILE_ATTACHMENT_ACCEPT =
  "application/pdf,.txt,.md,.csv,.json,.xml,.log,.yaml,.yml,.toml,.ini,.sh,.py,.js,.ts,.tsx,.jsx,.html,.css";
const DEFAULT_ATTACHMENT_ACCEPT = `${IMAGE_ATTACHMENT_ACCEPT},${FILE_ATTACHMENT_ACCEPT}`;

interface CommandComposerContainerV2Props {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<boolean>;
  stopGeneration: () => void;
  isLoading: boolean;
  error: string | null;
  responseMode?: ResponseMode;
  onResponseModeChange?: (mode: ResponseMode) => void;
}

function formatRecordingDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function CommandComposerContainerV2({
  sendMessage,
  stopGeneration,
  isLoading,
  error,
  responseMode: externalResponseMode,
  onResponseModeChange,
}: CommandComposerContainerV2Props) {
  const isMobile = useIsMobile();
  const [input, setInput] = useState("");
  const [internalResponseMode, setInternalResponseMode] = useState<ResponseMode>("default");
  const responseMode = externalResponseMode ?? internalResponseMode;
  const setResponseMode = onResponseModeChange ?? setInternalResponseMode;
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechInputBaseRef = useRef("");
  const {
    attachments,
    isProcessing,
    errors: fileErrors,
    addFiles,
    removeFile,
    clearFiles,
  } = useFileAttachments();
  const {
    audioLevel,
    error: speechError,
    isSupported: speechSupported,
    recordingDurationMs,
    status: speechStatus,
    transcriptPreview,
    toggleRecording,
  } = useSpeechToText();
  const { parameters, updateParameters } = useSettingsStore();

  const modelList = useMemo(() => getChatModels(), []);
  const hasReasoning = useMemo(() => checkReasoning(parameters.model), [parameters.model]);
  const isDeepsearchMode =
    responseMode === "deepsearch_medium" || responseMode === "deepsearch_high";
  const currentModel = MODELS[parameters.model];
  const isDeepSeekSelected = isDeepSeekModel(parameters.model);
  const supportedReasoningEfforts = useMemo(
    () => getSupportedReasoningEfforts(parameters.model),
    [parameters.model]
  );
  const hasProMode =
    modelSupportsReasoningMode(parameters.model, "pro") &&
    responseMode !== "quiz" &&
    !isDeepsearchMode;
  const deepsearchModelId =
    responseMode === "deepsearch_high" ? "gpt-5.4" : "gpt-5.4-mini";
  const displayModel = isDeepsearchMode ? MODELS[deepsearchModelId] : currentModel;
  const deepsearchModelLabel = MODELS[deepsearchModelId]?.name ?? deepsearchModelId;
  const currentReasoning = REASONING_OPTIONS.find(
    (option) => option.value === parameters.reasoningEffort
  );
  const isRecording = speechStatus === "recording";
  const isTranscribing = speechStatus === "transcribing";
  const hasContent = input.trim().length > 0 || attachments.length > 0;
  const speechStatusLabel = useMemo(() => {
    if (isRecording) return "Gravando";
    if (isTranscribing) return "Transcrevendo";
    if (speechStatus === "error") return "Falha";
    return "Voz";
  }, [isRecording, isTranscribing, speechStatus]);

  const placeholder = isRecording
    ? "Gravando teu audio..."
    : responseMode === "document"
    ? "Descreva o documento que tu quer elaborar..."
    : responseMode === "deepsearch_medium"
    ? "Descreva o tema da pesquisa (Deepsearch Medium)..."
    : responseMode === "deepsearch_high"
    ? "Descreva o tema da pesquisa (Deepsearch High)..."
    : responseMode === "quiz"
    ? `Descreva o assunto do quiz. O modo quiz entrega no minimo ${QUIZ_MIN_QUESTION_COUNT} questoes...`
    : attachments.length > 0
    ? "Adicione uma mensagem sobre os arquivos..."
    : "Mensagem para o GPT...";

  const handleSubmit = useCallback(async () => {
    if (!canSubmitComposerMessage({ hasContent, isProcessing })) return;

    const sent = await sendMessage(input, {
      responseMode,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (sent) {
      setInput("");
      setResponseMode("default");
      clearFiles();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    clearFiles,
    hasContent,
    input,
    isProcessing,
    responseMode,
    sendMessage,
    setResponseMode,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleMicrophoneClick = useCallback(async () => {
    if (!isRecording) {
      speechInputBaseRef.current = input;
    }
    const transcript = await toggleRecording();
    if (!transcript) return;

    setInput(() => {
      const current = speechInputBaseRef.current;
      const trimmed = current.trim();
      if (!trimmed) return transcript;
      return `${current}${current.endsWith("\n") ? "" : "\n"}${transcript}`;
    });
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
      textareaRef.current.focus();
    });
  }, [input, isRecording, toggleRecording]);

  useEffect(() => {
    if (!isTranscribing || !transcriptPreview) return;
    const base = speechInputBaseRef.current;
    setInput(
      base.trim()
        ? `${base}${base.endsWith("\n") ? "" : "\n"}${transcriptPreview}`
        : transcriptPreview
    );
  }, [isTranscribing, transcriptPreview]);

  const openAttachmentPicker = useCallback((mode: "file" | "image") => {
    const input = fileInputRef.current;
    if (!input) return;

    input.accept = mode === "image" ? IMAGE_ATTACHMENT_ACCEPT : FILE_ATTACHMENT_ACCEPT;
    input.click();
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(event.clipboardData.items)) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles]
  );

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);
      if (event.dataTransfer.files.length > 0) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      setInput((current) => {
        const prefix = current.trim() ? `${current.trim()}\n\n` : "";
        return `${prefix}> ${text}\n\n`;
      });
      textareaRef.current?.focus();
    };
    window.addEventListener("gaucho:quote-text", handler);
    return () => window.removeEventListener("gaucho:quote-text", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { mode } = (e as CustomEvent<{ mode: string }>).detail;
      setResponseMode(mode as ResponseMode);
    };
    window.addEventListener("gaucho:set-response-mode", handler);
    return () => window.removeEventListener("gaucho:set-response-mode", handler);
  }, [setResponseMode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      setInput(text);
      window.setTimeout(() => void handleSubmit(), 0);
    };
    window.addEventListener("gaucho:send-message", handler);
    return () => window.removeEventListener("gaucho:send-message", handler);
  }, [handleSubmit]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleFocus = () => {
      if (isMobile) return;
      window.setTimeout(() => {
        textarea.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 350);
    };

    textarea.addEventListener("focus", handleFocus);
    return () => textarea.removeEventListener("focus", handleFocus);
  }, [isMobile]);

  const modelControl = (
    <Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading || isTranscribing || isDeepsearchMode}
            aria-label="Selecionar modelo"
            title={isDeepsearchMode ? `Deepsearch usa modelo fixo (${deepsearchModelLabel}).` : undefined}
            className="h-[var(--gc-mobile-control-height)] max-w-[9rem] gap-1 rounded-lg border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] px-2.5 text-[var(--gc-mobile-control-font-size)] font-medium text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground md:h-8 md:max-w-[10rem] md:rounded-lg md:px-2.5 md:text-nano"
          >
            <span className="truncate">{displayModel?.name || parameters.model}</span>
            <ChevronDown className="size-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Modelo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {modelList.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => updateParameters({ model: model.id })}
              className={cn(
                "flex flex-col items-start gap-0.5 py-2",
                parameters.model === model.id && "bg-primary/10 text-foreground"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-medium">{model.name}</span>
                {model.badge && (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-nano font-semibold text-primary">
                    {model.badge}
                  </span>
                )}
              </div>
              <span className="line-clamp-1 text-nano text-muted-foreground">
                {model.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {isDeepsearchMode && (
        <TooltipContent>
          Deepsearch usa modelo fixo ({deepsearchModelLabel}).
        </TooltipContent>
      )}
    </Tooltip>
  );

  const reasoningOpacity = useMemo(() => {
    const map: Record<ReasoningEffort, number> = {
      none: 0.3,
      low: 0.45,
      medium: 0.6,
      high: 0.8,
      xhigh: 0.9,
      max: 1.0,
    };
    return map[parameters.reasoningEffort] ?? 0.6;
  }, [parameters.reasoningEffort]);

  const reasoningControl = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading || isTranscribing || isDeepSeekSelected}
              aria-label="Ajustar nível de raciocínio"
              className="size-[var(--gc-mobile-control-height)] rounded-lg border border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] p-0 text-[var(--gc-mobile-control-font-size)] text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground md:h-8 md:w-8 md:rounded-lg md:text-nano"
            >
              <Brain className="size-3.5" style={{ opacity: reasoningOpacity }} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {isDeepSeekSelected
            ? "DeepSeek usa raciocinio maximo fixo"
            : `Raciocínio: ${currentReasoning?.label || "Medio"}`}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Raciocinio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REASONING_OPTIONS.filter((option) =>
          supportedReasoningEfforts.includes(option.value)
        ).map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => updateParameters({ reasoningEffort: option.value })}
            disabled={isDeepSeekSelected}
            className={cn(
              "flex flex-col items-start gap-0.5",
              parameters.reasoningEffort === option.value && "bg-primary/10 text-foreground"
            )}
          >
            <span className="text-xs font-medium">{option.label}</span>
            <span className="text-nano text-muted-foreground">{option.desc}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const proControl = hasProMode ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isLoading || isTranscribing}
          aria-label={parameters.reasoningMode === "pro" ? "Desativar modo Pro" : "Ativar modo Pro"}
          aria-pressed={parameters.reasoningMode === "pro"}
          onClick={() =>
            updateParameters({
              reasoningMode: parameters.reasoningMode === "pro" ? "standard" : "pro",
            })
          }
          className={cn(
            "size-[var(--gc-mobile-control-height)] rounded-lg border p-0 md:h-8 md:w-8",
            parameters.reasoningMode === "pro"
              ? "border-amber-500/45 bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
              : "border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] text-muted-foreground hover:bg-[var(--gc-surface-control-hover)] hover:text-foreground"
          )}
        >
          <Zap className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {parameters.reasoningMode === "pro"
          ? "Pro ativo: mais qualidade, latencia e uso de tokens"
          : "Pro: mais qualidade, latencia e uso de tokens"}
      </TooltipContent>
    </Tooltip>
  ) : undefined;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={DEFAULT_ATTACHMENT_ACCEPT}
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            addFiles(event.target.files);
            event.target.value = "";
          }
        }}
        className="hidden"
      />
      <CommandComposerV2
        textareaRef={textareaRef}
        value={input}
        placeholder={placeholder}
        attachments={attachments}
        isLoading={isLoading}
        isProcessing={isProcessing}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        audioLevel={audioLevel}
        speechSupported={speechSupported}
        speechStatusLabel={speechStatusLabel}
        hasContent={hasContent}
        modelName={currentModel?.name || parameters.model}
        reasoningLabel={currentReasoning?.label || "Medio"}
        hasReasoning={hasReasoning}
        responseMode={responseMode}
        error={error}
        speechError={speechError}
        fileErrors={fileErrors.map((fileError) => `${fileError.fileName}: ${fileError.error}`)}
        recordingDurationLabel={
          isRecording ? formatRecordingDuration(recordingDurationMs) : null
        }
        modelControl={modelControl}
        reasoningControl={hasReasoning ? reasoningControl : undefined}
        proControl={proControl}
        onValueChange={setInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSubmit={() => {
          void handleSubmit();
        }}
        onStop={stopGeneration}
        onFileSelect={() => openAttachmentPicker("file")}
        onImageSelect={() => openAttachmentPicker("image")}
        onMicrophoneClick={() => {
          void handleMicrophoneClick();
        }}
        onSelectDocumentMode={(mode) =>
          setResponseMode(responseMode === mode ? "default" : mode)
        }
        onToggleQuiz={() =>
          setResponseMode(responseMode === "quiz" ? "default" : "quiz")
        }
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onRemoveAttachment={removeFile}
        isDragging={isDragging}
      />
      {(responseMode === "document" ||
        responseMode === "deepsearch_medium" ||
        responseMode === "deepsearch_high") && (
        <div className="sr-only">
          Documento e Deepsearch geram conteúdo em formato de documento e retornam no Canvas.
        </div>
      )}
      {isDeepsearchMode && (
        <div className="sr-only">
          Em Deepsearch, o seletor de modelo fica bloqueado para preservar o perfil da pesquisa.
        </div>
      )}
      {responseMode === "quiz" && (
        <div className="sr-only">
          Quiz usa {QUIZ_FORCED_MODEL} com reasoning {QUIZ_FORCED_REASONING_EFFORT}.
        </div>
      )}
    </>
  );
}
