"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useSettingsStore } from "@/stores/settingsStore";
import { MODELS, isReasoningModel as checkReasoning, modelSupportsTemperature, getChatModels } from "@/lib/models/modelConfig";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Square, Brain, ChevronDown } from "lucide-react";
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


export function InputArea() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, stopGeneration, isLoading, error } = useChat();
  const { parameters, updateParameters } = useSettingsStore();

  const modelList = useMemo(() => getChatModels(), []);

  const hasReasoning = useMemo(() => {
    return checkReasoning(parameters.model);
  }, [parameters.model]);

  const currentModel = MODELS[parameters.model];
  const currentReasoning = REASONING_OPTIONS.find((r) => r.value === parameters.reasoningEffort);

  const handleModelChange = useCallback((newModel: string) => {
    const newIsReasoning = checkReasoning(newModel);
    const newSupportsTemp = modelSupportsTemperature(newModel);
    updateParameters({
      model: newModel,
      ...(!newIsReasoning && { reasoningEffort: "none" }),
      ...(newSupportsTemp && !checkReasoning(newModel) && { temperature: 0.7 }),
    });
  }, [updateParameters]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    textareaRef.current?.focus();
  }, [input, sendMessage]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

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

  const disabled = isLoading;

  return (
    <div className="border-t border-white/5 bg-background/40 backdrop-blur-2xl pb-[env(safe-area-inset-bottom)] md:pb-0">
      <div className="mx-auto w-full max-w-5xl px-4 py-4">
        {error && (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription className="text-xs">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className={cn(
          "rounded-2xl border border-white/10 bg-background/70 backdrop-blur-xl shadow-lg",
          "transition-shadow duration-200",
          "focus-within:shadow-xl focus-within:border-primary/30"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mensagem para o GPT..."
            className={cn(
              "w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm",
              "outline-none placeholder:text-muted-foreground/50",
              "min-h-[44px] max-h-[200px]"
            )}
            rows={1}
            disabled={disabled}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="h-7 gap-1 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/5"
                  >
                    <span className="max-w-[100px] truncate">{currentModel?.name || parameters.model}</span>
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
                    className="h-7 gap-1 rounded-full px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-white/5"
                  >
                    <Brain className="h-3 w-3" />
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
            </div>

            <div className="flex items-center gap-1.5">
              {disabled ? (
                <Button
                  onClick={stopGeneration}
                  variant="destructive"
                  size="sm"
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  <Square className="mr-1.5 h-3.5 w-3.5" />
                  Parar
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  size="sm"
                  disabled={!input.trim()}
                  className={cn(
                    "h-9 rounded-xl px-4 text-xs",
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

        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
