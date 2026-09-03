"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Brain,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  User,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemories } from "@/hooks/useMemories";
import { useMemorySuggestions } from "@/hooks/useMemorySuggestions";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import {
  MODELS,
  isDeepSeekModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { useDebounce } from "@/lib/performance/debounce";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isTtsAudioFormat, TTS_AUDIO_FORMATS, TTS_VOICES, DEFAULT_TTS_INSTRUCTIONS } from "@/lib/tts/speechText";
import { indexRecentConversationMemories } from "@/lib/storage/memoryRag";
import { BASE_SYSTEM_PROMPT } from "@/lib/prompts/systemPrompt";
import { FIXED_PERSONA_PROMPT } from "@/lib/prompts/personaPrompt";
import { MEMORY_CATEGORIES } from "@/types";
import type { Memory, MemorySuggestion } from "@/types";

const IMAGE_SIZES = [
  { id: "1024x1024", label: "Quadrada 1024" },
  { id: "1536x1024", label: "Paisagem 1536x1024" },
  { id: "1024x1536", label: "Retrato 1024x1536" },
  { id: "auto", label: "Auto" },
];

const IMAGE_QUALITIES = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
];

const TTS_MODES = [
  { id: "turbo", label: "Rápido" },
  { id: "balanced", label: "Equilibrado" },
] as const;

const VERBOSITY_OPTIONS = [
  { id: "low", label: "Baixo", description: "Resposta mais enxuta." },
  { id: "medium", label: "Médio", description: "Equilíbrio entre clareza e detalhe." },
  { id: "high", label: "Alto", description: "Mais contexto e explicação." },
] as const;

const SETTINGS_TABS = [
  { key: "tuning", label: "Tuning", icon: Sliders },
  { key: "memory", label: "Memória", icon: Brain },
  { key: "persona", label: "Persona", icon: User },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MemoryCardProps {
  memory: Memory;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Memory>) => Promise<void>;
}

interface MemorySuggestionCardProps {
  suggestion: MemorySuggestion;
  isUpdating: boolean;
  onAccept: (id: string, content: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

function SaveStatusBadge({
  status,
  idleLabel = "Pronto",
}: {
  status: SaveStatus;
  idleLabel?: string;
}) {
  if (status === "saving") {
    return (
      <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-nano text-primary">
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Salvando
      </Badge>
    );
  }

  if (status === "saved") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/8 text-nano text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Salvo
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-destructive/25 bg-destructive/8 text-nano text-destructive">
        <AlertCircle className="h-3 w-3" />
        Erro
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-control)] text-nano text-muted-foreground/80">
      {idleLabel}
    </Badge>
  );
}

function MemoryCard({ memory, onDelete, onUpdate }: MemoryCardProps) {
  const [draft, setDraft] = useState(memory.content);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDeleting, setIsDeleting] = useState(false);
  const debouncedDraft = useDebounce(draft, 700);

  useEffect(() => {
    const trimmed = debouncedDraft.trim();
    if (!trimmed || trimmed === memory.content) return;

    let cancelled = false;

    const persistDraft = async () => {
      setSaveStatus("saving");

      try {
        await onUpdate(memory.id, { content: trimmed });
        if (cancelled) return;
        setSaveStatus("saved");
      } catch {
        if (cancelled) return;
        setSaveStatus("error");
      }
    };

    void persistDraft();

    return () => {
      cancelled = true;
    };
  }, [debouncedDraft, memory.content, memory.id, onUpdate]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timeout = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const handleToggle = async (checked: boolean) => {
    setSaveStatus("saving");
    try {
      await onUpdate(memory.id, { isActive: checked });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(memory.id);
    } catch {
      setIsDeleting(false);
      setSaveStatus("error");
    }
  };

  return (
    <div
      className={cn(
        "gc-refined-panel rounded-2xl border p-3 transition-colors",
        !memory.isActive && "opacity-80"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={memory.isActive}
            onCheckedChange={handleToggle}
            aria-label={`${memory.isActive ? "Pausar" : "Ativar"} memória`}
          />
          <span className="text-micro font-medium uppercase tracking-eyebrow text-muted-foreground/75">
            {memory.isActive ? "Ativa" : "Pausada"}
          </span>
        </div>
        <SaveStatusBadge status={saveStatus} idleLabel="Inline" />
      </div>

      <textarea
        id={`memory-${memory.id}`}
        aria-label="Conteúdo da memória"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          setDraft(trimmed || memory.content);
        }}
        rows={3}
        className={cn(
          "gc-refined-soft-surface min-h-[74px] w-full resize-none rounded-xl border px-3 py-2 text-body-sm leading-relaxed outline-none transition-all sm:min-h-[84px] sm:py-2.5 sm:text-sm",
          "focus:border-primary/40 focus:ring-2 focus:ring-primary/15",
          !memory.isActive && "text-muted-foreground/70"
        )}
      />

      <div className="mt-2 flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Excluir memória"
          className="h-8 rounded-xl px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MemorySuggestionCard({
  suggestion,
  isUpdating,
  onAccept,
  onReject,
}: MemorySuggestionCardProps) {
  const [draft, setDraft] = useState(suggestion.content);

  return (
    <div className="gc-refined-panel rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-primary">
            Sugestão de memória
          </p>
          <p className="mt-0.5 text-nano text-muted-foreground">
            {MEMORY_CATEGORIES[suggestion.category]} · confiança{" "}
            {Math.round(suggestion.confidence * 100)}%
          </p>
        </div>
        {isUpdating && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />}
      </div>

      <textarea
        id={`memory-suggestion-${suggestion.id}`}
        aria-label="Conteúdo sugerido para memória"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        className="gc-refined-soft-surface min-h-[74px] w-full resize-none rounded-xl border px-3 py-2 text-body-sm leading-relaxed outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15 sm:min-h-[84px] sm:py-2.5 sm:text-sm"
      />

      <div className="mt-2 flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void onReject(suggestion.id)}
          disabled={isUpdating}
          aria-label="Rejeitar sugestão de memória"
          className="h-8 rounded-xl px-2 text-muted-foreground hover:text-destructive"
        >
          <XCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void onAccept(suggestion.id, draft.trim())}
          disabled={isUpdating || !draft.trim()}
          aria-label="Aceitar sugestão de memória"
          className="h-8 rounded-xl px-2"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { parameters, updateParameters } = useSettingsStore();
  const {
    activeMode,
    imageQuality,
    imageSize,
    setImageQuality,
    setImageSize,
  } = useUIStore();
  const { memories = [], addMemory, updateMemory, deleteMemory } = useMemories();
  const {
    suggestions,
    isLoading: isLoadingSuggestions,
    isUpdating: updatingSuggestionId,
    refresh: refreshSuggestions,
    acceptSuggestion,
    rejectSuggestion,
  } = useMemorySuggestions();
  const {
    contextAboutUser,
    responsePreferences,
    customSystemInstructions,
    ttsPreferences,
    updateContextAboutUser,
    updateResponsePreferences,
    updateCustomSystemInstructions,
    updateTtsPreferences,
    isSaving,
    isLoaded,
    saveStatus,
  } = useCustomInstructions();
  const [activeTab, setActiveTab] = useState<SettingsTab>("tuning");
  const [newMemory, setNewMemory] = useState("");
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);
  const [isIndexingMemory, setIsIndexingMemory] = useState(false);

  const currentModel = MODELS[parameters.model];
  const isDeepSeekSelected = isDeepSeekModel(parameters.model);
  const showTemperature = modelSupportsTemperature(parameters.model);
  const showVerbosity = modelSupportsVerbosity(parameters.model);
  const showCodeInterpreter = modelSupportsCodeInterpreter(parameters.model);
  const maxTokensLimit = currentModel?.maxOutput ?? parameters.maxOutputTokens;
  const minTokensLimit = Math.min(256, maxTokensLimit);
  const mainPromptPreview = useMemo(
    () => `${BASE_SYSTEM_PROMPT}\n\n---\n\n${FIXED_PERSONA_PROMPT}`,
    []
  );

  const panelStatus = useMemo<SaveStatus>(() => {
    if (activeTab === "persona" || activeTab === "tuning") return saveStatus;
    if (
      isCreatingMemory ||
      isIndexingMemory ||
      isLoadingSuggestions ||
      updatingSuggestionId
    ) {
      return "saving";
    }
    return "idle";
  }, [
    activeTab,
    isCreatingMemory,
    isIndexingMemory,
    isLoadingSuggestions,
    saveStatus,
    updatingSuggestionId,
  ]);

  const handleAddMemory = async () => {
    const content = newMemory.trim();
    if (!content) return;

    setIsCreatingMemory(true);
    try {
      await addMemory({
        content,
        category: "personal",
        isActive: true,
        priority: 0,
      });
      setNewMemory("");
    } catch {
      toast.error("Não consegui salvar essa memória agora.");
    } finally {
      setIsCreatingMemory(false);
    }
  };

  const handleIndexRecentMemory = async () => {
    setIsIndexingMemory(true);
    try {
      const result = await indexRecentConversationMemories(75);
      const removedChunks = result.reconciliation?.removedChunks ?? 0;
      toast.success(
        removedChunks > 0
          ? `RAG atualizado: ${result.stats.chunks} chunks ativos; ${removedChunks} órfãos removidos.`
          : `RAG atualizado: ${result.stats.chunks} chunks ativos.`
      );
    } catch {
      toast.error("Não consegui indexar o histórico agora.");
    } finally {
      setIsIndexingMemory(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gc-clinical-panel !w-screen !max-w-none gap-0 !border-l-0 border-[color:var(--gc-border-soft)] p-0 pt-[env(safe-area-inset-top)] pb-[max(var(--gc-mobile-panel-content-pad),env(safe-area-inset-bottom))] shadow-none sm:!w-[26.5rem] sm:!max-w-[26.5rem] sm:!border-l sm:shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Configurações</SheetTitle>
          <SheetDescription>Ajustes, memórias e contexto do Gaucho Chat.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="gc-clinical-section-header border-b border-[color:var(--gc-border-soft)] px-[var(--gc-mobile-context-header-x)] pb-[var(--gc-mobile-context-header-y)] sm:border-[color:var(--gc-border)]">
            <div className="flex items-start justify-between gap-2 px-0 pt-[var(--gc-mobile-context-header-y)] sm:px-1">
              <div className="min-w-0">
                <h2 className="text-[1rem] font-semibold tracking-[-0.02em] text-foreground sm:text-lg sm:tracking-[-0.03em]">
                  Configurações
                </h2>
                <p className="mt-0.5 text-micro uppercase tracking-eyebrow text-muted-foreground/70 sm:mt-1">
                  Ajustes, memórias e contexto
                </p>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <SaveStatusBadge
                  status={panelStatus}
                  idleLabel={
                    activeTab === "persona" || activeTab === "tuning"
                      ? "Autosave"
                      : "Sincronizado"
                  }
                />
                <ThemeToggle />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar configurações"
                  onClick={onClose}
                  className="gc-clinical-input-surface size-[var(--gc-mobile-icon-button-size)] rounded-xl border border-[color:var(--gc-border-soft)] hover:bg-[var(--gc-surface-control-hover)] sm:h-8 sm:w-8 sm:border-[color:var(--gc-border)]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Seções das configurações"
              className="mt-[var(--gc-mobile-context-header-y)] grid grid-cols-3 gap-1 rounded-xl border border-[color:var(--gc-border-soft)] bg-background/72 p-1 sm:rounded-2xl"
            >
              {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "gc-settings-tab flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[length:var(--gc-mobile-tab-font-size)] font-semibold transition-all sm:rounded-xl sm:py-2 sm:text-micro",
                    activeTab === key
                      ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(15,118,110,0.18)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-[var(--gc-mobile-panel-content-pad)] pb-[var(--gc-mobile-panel-content-pad)] pt-[var(--gc-mobile-panel-content-pad)]">
            {activeTab === "tuning" && (
              <div className="space-y-[var(--gc-mobile-settings-section-gap)]">
                <div className="gc-refined-accent-surface rounded-[1.6rem] border p-[var(--gc-mobile-settings-card-pad)] text-body-sm shadow-[0_18px_36px_rgba(15,118,110,0.10)] sm:text-sm">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Sparkles className="h-4 w-4" />
                    {currentModel?.name || parameters.model}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {currentModel?.description || "Modelo selecionado"}
                  </p>
                  <p className="mt-2 text-nano text-muted-foreground/80">
                    O seletor de modelo continua na área de input.
                  </p>
                </div>

                {activeMode === "chat" && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                        Tuning do Modelo
                      </h3>
                      <div className="gc-refined-panel space-y-4 rounded-[1.35rem] border p-[var(--gc-mobile-settings-card-pad)]">
                        {showTemperature && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium">Temperature</p>
                                <p className="text-micro text-muted-foreground">
                                  Controla criatividade e variação de resposta.
                                </p>
                              </div>
                              <span className="text-xs font-mono font-semibold">
                                {parameters.temperature.toFixed(2)}
                              </span>
                            </div>
                            <Slider
                              min={0}
                              max={2}
                              step={0.05}
                              value={[parameters.temperature]}
                              onValueChange={([value]) => updateParameters({ temperature: value })}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium">Max Tokens</p>
                              <p className="text-micro text-muted-foreground">
                                Limita o tamanho máximo da resposta do modelo atual.
                              </p>
                            </div>
                            <span className="text-xs font-mono font-semibold">
                              {parameters.maxOutputTokens.toLocaleString()}
                            </span>
                          </div>
                          <Slider
                            min={minTokensLimit}
                            max={maxTokensLimit}
                            step={256}
                            value={[parameters.maxOutputTokens]}
                            onValueChange={([value]) =>
                              updateParameters({ maxOutputTokens: value })
                            }
                          />
                          <p className="text-micro text-muted-foreground">
                            Limite do modelo: {maxTokensLimit.toLocaleString()} tokens.
                          </p>
                        </div>
                      </div>
                    </div>

                    {showVerbosity && (
                      <div className="space-y-3">
                        <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                          Verbosity
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {VERBOSITY_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              disabled={isDeepSeekSelected}
                              onClick={() => updateParameters({ verbosity: option.id })}
                              className={cn(
                                "gc-refined-panel rounded-xl border p-[var(--gc-mobile-settings-card-pad)] text-left transition-colors sm:p-3",
                                parameters.verbosity === option.id
                                  ? "border-primary/30 bg-primary/10 text-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                                isDeepSeekSelected && "cursor-not-allowed opacity-70 hover:text-muted-foreground"
                              )}
                            >
                              <p className="text-xs font-medium">{option.label}</p>
                              <p className="mt-1 text-micro leading-relaxed">
                                {option.description}
                              </p>
                            </button>
                          ))}
                        </div>
                        {isDeepSeekSelected && (
                          <p className="text-micro text-muted-foreground">
                            DeepSeek V4 Pro usa verbosity alta fixa neste fluxo.
                          </p>
                        )}
                      </div>
                    )}

                    {showCodeInterpreter && (
                      <div className="space-y-3">
                        <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                          Ferramentas
                        </h3>
                        <div className="gc-refined-panel flex items-start justify-between gap-4 rounded-[1.35rem] border p-[var(--gc-mobile-settings-card-pad)]">
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Code Interpreter</p>
                            <p className="text-micro leading-relaxed text-muted-foreground">
                              Expõe um container Python para o modelo usar quando achar necessário.
                            </p>
                          </div>
                          <Switch
                            checked={parameters.codeInterpreterEnabled}
                            aria-label="Ativar Code Interpreter"
                            onCheckedChange={(checked) =>
                              updateParameters({ codeInterpreterEnabled: checked })
                            }
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h3 className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                        <Volume2 className="h-3 w-3" />
                        Voz
                      </h3>
                      <div className="gc-refined-panel space-y-4 rounded-[1.35rem] border p-[var(--gc-mobile-settings-card-pad)]">
                        <p className="text-micro leading-relaxed text-muted-foreground">
                          A voz e as instruções são compartilhadas. Modo, formato e
                          velocidade afetam somente o TTS padrão; o Realtime usa uma
                          cadência fluida própria.
                        </p>
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-muted-foreground">
                            Modo — TTS padrão
                          </span>
                          <select
                            value={ttsPreferences.mode}
                            onChange={(e) =>
                              updateTtsPreferences({
                                mode: e.target.value === "balanced" ? "balanced" : "turbo",
                              })
                            }
                            className="gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs"
                          >
                            {TTS_MODES.map((mode) => (
                              <option key={mode.id} value={mode.id}>
                                {mode.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-muted-foreground">
                            Voz — TTS + Realtime
                          </span>
                          <select
                            value={ttsPreferences.voice}
                            onChange={(e) => updateTtsPreferences({ voice: e.target.value })}
                            className="gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs"
                          >
                            {TTS_VOICES.map((voice) => (
                              <option key={voice} value={voice}>
                                {voice}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-muted-foreground">
                            Formato — TTS padrão
                          </span>
                          <select
                            value={ttsPreferences.format}
                            onChange={(e) =>
                              updateTtsPreferences({
                                format: isTtsAudioFormat(e.target.value)
                                  ? e.target.value
                                  : "flac",
                              })
                            }
                            className="gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs"
                          >
                            {TTS_AUDIO_FORMATS.map((format) => (
                              <option key={format} value={format}>
                                {format.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium">
                                Velocidade — TTS padrão
                              </p>
                              <p className="text-micro text-muted-foreground">
                                Ajusta o ritmo da fala gerada.
                              </p>
                            </div>
                            <span className="text-xs font-mono font-semibold">
                              {ttsPreferences.speed.toFixed(2)}x
                            </span>
                          </div>
                          <Slider
                            min={0.75}
                            max={1.5}
                            step={0.05}
                            value={[ttsPreferences.speed]}
                            onValueChange={([value]) => updateTtsPreferences({ speed: value })}
                          />
                        </div>

                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="tts-voice-instructions"
                              className="text-muted-foreground"
                            >
                              Instruções da voz — TTS + Realtime
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateTtsPreferences({
                                  instructions: DEFAULT_TTS_INSTRUCTIONS,
                                })
                              }
                              disabled={
                                ttsPreferences.instructions === DEFAULT_TTS_INSTRUCTIONS
                              }
                              className="text-micro font-medium text-primary hover:underline disabled:cursor-default disabled:opacity-50 disabled:no-underline"
                            >
                              Restaurar padrão
                            </button>
                          </div>
                          <textarea
                            id="tts-voice-instructions"
                            value={ttsPreferences.instructions}
                            onChange={(e) =>
                              updateTtsPreferences({ instructions: e.target.value })
                            }
                            placeholder="Vazio = sem instruções. Use “Restaurar padrão” para carregar a leitura recomendada."
                            rows={5}
                            className="gc-refined-soft-surface min-h-[68px] resize-none rounded-xl border px-3 py-2 text-xs outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15 sm:min-h-[78px]"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeMode === "image" && (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />
                      Geração de Imagem
                    </h3>
                    <div className="gc-refined-panel space-y-2 rounded-[1.35rem] border p-[var(--gc-mobile-settings-card-pad)]">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Tamanho</span>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value)}
                          className="gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs"
                        >
                          {IMAGE_SIZES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Qualidade</span>
                        <select
                          value={imageQuality}
                          onChange={(e) => setImageQuality(e.target.value)}
                          className="gc-refined-soft-surface rounded-xl border px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-primary/20 sm:text-xs"
                        >
                          {IMAGE_QUALITIES.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "memory" && (
              <div className="space-y-4">
                <div className="gc-refined-accent-surface rounded-2xl border p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Memórias ativas entram no prompt. Sugestões vindas das conversas ficam
                    pendentes até tu aceitar, editar ou rejeitar.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleIndexRecentMemory()}
                    disabled={isIndexingMemory}
                    className="mt-3 h-8 rounded-xl"
                  >
                    {isIndexingMemory ? (
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Indexar histórico
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      Sugestões pendentes
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void refreshSuggestions()}
                      disabled={isLoadingSuggestions}
                      className="h-8 rounded-xl px-2"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          isLoadingSuggestions && "animate-spin"
                        )}
                      />
                    </Button>
                  </div>

                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion) => (
                      <MemorySuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        isUpdating={updatingSuggestionId === suggestion.id}
                        onAccept={async (id, content) => {
                          try {
                            await acceptSuggestion(id, content);
                            toast.success("Memória ativada.");
                          } catch {
                            toast.error("Não consegui aceitar essa sugestão.");
                          }
                        }}
                        onReject={async (id) => {
                          try {
                            await rejectSuggestion(id);
                          } catch {
                            toast.error("Não consegui rejeitar essa sugestão.");
                          }
                        }}
                      />
                    ))
                  ) : (
                    <div className="gc-refined-panel rounded-2xl border-2 border-dashed px-4 py-5 text-center">
                      <p className="text-xs text-muted-foreground">
                        Nenhuma sugestão pendente.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <textarea
                    aria-label="Nova memória"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Ex: Sempre explique código em detalhe..."
                    rows={2}
                    className="gc-refined-soft-surface min-h-[72px] flex-1 resize-none rounded-2xl border p-3 text-xs outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && newMemory.trim()) {
                        e.preventDefault();
                        void handleAddMemory();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    aria-label="Adicionar memória"
                    onClick={() => void handleAddMemory()}
                    disabled={isCreatingMemory || !newMemory.trim()}
                    className="h-auto min-h-[72px] rounded-2xl bg-primary px-3 text-primary-foreground hover:opacity-90"
                  >
                    {isCreatingMemory ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  {memories.length === 0 ? (
                    <div className="gc-refined-panel rounded-2xl border-2 border-dashed px-4 py-8 text-center">
                      <Brain className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-xs">Nenhuma memória cadastrada.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cria uma acima e ela já entra no teu contexto.
                      </p>
                    </div>
                  ) : (
                    memories.map((memory) => (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        onDelete={deleteMemory}
                        onUpdate={updateMemory}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "persona" && (
              <div className="space-y-4">
                <div className="gc-refined-accent-surface rounded-2xl border p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Persona e regras base seguem fixas no servidor. Abaixo tu enxerga o
                    prompt principal e ajusta o contexto extra que entra junto nas respostas.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="main-prompt-preview" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Prompt principal
                  </label>
                  <textarea
                    id="main-prompt-preview"
                    value={mainPromptPreview}
                    readOnly
                    rows={8}
                    className="gc-refined-soft-surface w-full resize-none rounded-2xl border p-3 font-mono text-nano leading-relaxed text-muted-foreground outline-none"
                  />
                  <p className="text-micro leading-relaxed text-muted-foreground/80">
                    Prévia somente leitura do prompt base e da persona fixa que entram antes
                    dos ajustes abaixo.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="context-about-user" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Sobre Você
                    </label>
                    <SaveStatusBadge
                      status={isLoaded ? saveStatus : isSaving ? "saving" : "idle"}
                      idleLabel="Autosave"
                    />
                  </div>
                  <textarea
                    id="context-about-user"
                    value={contextAboutUser}
                    onChange={(e) => updateContextAboutUser(e.target.value)}
                    placeholder="Contexto adicional sobre você..."
                    rows={7}
                    className="gc-refined-soft-surface w-full resize-none rounded-2xl border p-3 text-xs outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="custom-system-instructions" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sliders className="h-3.5 w-3.5" />
                    Regras customizadas
                  </label>
                  <textarea
                    id="custom-system-instructions"
                    value={customSystemInstructions}
                    onChange={(e) => updateCustomSystemInstructions(e.target.value)}
                    placeholder="Regras adicionais que entram no prompt do sistema..."
                    rows={5}
                    className="gc-refined-soft-surface w-full resize-none rounded-2xl border p-3 text-xs outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="response-preferences" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Preferências de Resposta
                  </label>
                  <textarea
                    id="response-preferences"
                    value={responsePreferences}
                    onChange={(e) => updateResponsePreferences(e.target.value)}
                    placeholder="Como tu prefere que a IA responda..."
                    rows={5}
                    className="gc-refined-soft-surface w-full resize-none rounded-2xl border p-3 text-xs outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
