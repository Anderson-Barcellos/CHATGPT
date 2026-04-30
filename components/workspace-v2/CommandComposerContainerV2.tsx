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
import { CommandComposerV2 } from "@/components/workspace-v2/WorkspaceLayoutV2";
import { useFileAttachments } from "@/hooks/useFileAttachments";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import {
  getChatModels,
  isReasoningModel as checkReasoning,
  MODELS,
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
  { value: "xhigh", label: "Maximo", desc: "Analise exaustiva" },
];

interface CommandComposerContainerV2Props {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<boolean>;
  stopGeneration: () => void;
  isLoading: boolean;
  error: string | null;
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
}: CommandComposerContainerV2Props) {
  const isMobile = useIsMobile();
  const [input, setInput] = useState("");
  const [responseMode, setResponseMode] = useState<ResponseMode>("default");
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    attachments,
    isProcessing,
    errors: fileErrors,
    addFiles,
    removeFile,
    clearFiles,
  } = useFileAttachments();
  const {
    error: speechError,
    isSupported: speechSupported,
    recordingDurationMs,
    status: speechStatus,
    toggleRecording,
  } = useSpeechToText();
  const { parameters, updateParameters } = useSettingsStore();

  const modelList = useMemo(() => getChatModels(), []);
  const hasReasoning = useMemo(() => checkReasoning(parameters.model), [parameters.model]);
  const currentModel = MODELS[parameters.model];
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
  }, [attachments, clearFiles, hasContent, input, isProcessing, responseMode, sendMessage]);

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
    const transcript = await toggleRecording();
    if (!transcript) return;

    setInput((current) => {
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
  }, [toggleRecording]);

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
  }, []);

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
  }, []);

  const modelControl = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading || isTranscribing}
          aria-label="Selecionar modelo"
          className="h-8 max-w-[9.5rem] gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-2 text-micro font-medium text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
        >
          <span className="truncate">{currentModel?.name || parameters.model}</span>
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
              parameters.model === model.id && "bg-primary/10"
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
  );

  const reasoningControl = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading || isTranscribing}
          aria-label="Ajustar nível de raciocínio"
          className="h-8 gap-1.5 rounded-lg border border-white/8 bg-white/[0.035] px-2 text-micro font-medium text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
        >
          <Brain className="size-3.5" />
          <span>{currentReasoning?.label || "Medio"}</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Raciocinio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REASONING_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => updateParameters({ reasoningEffort: option.value })}
            className={cn(
              "flex flex-col items-start gap-0.5",
              parameters.reasoningEffort === option.value && "bg-primary/10"
            )}
          >
            <span className="text-xs font-medium">{option.label}</span>
            <span className="text-nano text-muted-foreground">{option.desc}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json,.xml,.log,.yaml,.yml,.toml,.ini,.sh,.py,.js,.ts,.tsx,.jsx,.html,.css"
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
        onValueChange={setInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSubmit={() => {
          void handleSubmit();
        }}
        onStop={stopGeneration}
        onFileSelect={() => fileInputRef.current?.click()}
        onMicrophoneClick={() => {
          void handleMicrophoneClick();
        }}
        onToggleDocument={() =>
          setResponseMode((current) => (current === "document" ? "default" : "document"))
        }
        onToggleQuiz={() =>
          setResponseMode((current) => (current === "quiz" ? "default" : "quiz"))
        }
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onRemoveAttachment={removeFile}
        isDragging={isDragging}
      />
      {responseMode === "document" && (
        <div className="sr-only">
          Documento usa o modelo ativo e gera conteúdo pronto para leitura e exportação.
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
