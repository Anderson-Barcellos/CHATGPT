"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemories } from "@/hooks/useMemories";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import {
  MODELS,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { useDebounce } from "@/lib/performance/debounce";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Memory } from "@/types";

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
    <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-nano text-muted-foreground/80">
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
        "rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors",
        !memory.isActive && "bg-white/[0.02]"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={memory.isActive} onCheckedChange={handleToggle} />
          <span className="text-micro font-medium uppercase tracking-eyebrow text-muted-foreground/75">
            {memory.isActive ? "Ativa" : "Pausada"}
          </span>
        </div>
        <SaveStatusBadge status={saveStatus} idleLabel="Inline" />
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          setDraft(trimmed || memory.content);
        }}
        rows={3}
        className={cn(
          "min-h-[84px] w-full resize-none rounded-xl border border-white/10 bg-background/80 px-3 py-2.5 text-sm leading-relaxed outline-none transition-all",
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
          className="h-8 rounded-xl px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
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
    contextAboutUser,
    responsePreferences,
    updateContextAboutUser,
    updateResponsePreferences,
    isSaving,
    isLoaded,
    saveStatus,
  } = useCustomInstructions();
  const [activeTab, setActiveTab] = useState<SettingsTab>("tuning");
  const [newMemory, setNewMemory] = useState("");
  const [isCreatingMemory, setIsCreatingMemory] = useState(false);

  const currentModel = MODELS[parameters.model];
  const showTemperature = modelSupportsTemperature(parameters.model);
  const showVerbosity = modelSupportsVerbosity(parameters.model);
  const showCodeInterpreter = modelSupportsCodeInterpreter(parameters.model);
  const maxTokensLimit = currentModel?.maxOutput ?? parameters.maxOutputTokens;
  const minTokensLimit = Math.min(256, maxTokensLimit);

  const panelStatus = useMemo<SaveStatus>(() => {
    if (activeTab === "persona") return saveStatus;
    if (isCreatingMemory) return "saving";
    return "idle";
  }, [activeTab, isCreatingMemory, saveStatus]);

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
        className="w-[82vw] max-w-[18rem] gap-0 border-white/10 bg-background/75 p-0 pt-[env(safe-area-inset-top)] pb-[max(0.75rem,env(safe-area-inset-bottom))] glass sm:max-w-[18rem]"
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-white/5 px-3 pb-3">
            <div className="flex items-start justify-between gap-2 px-1 pt-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-wide gc-text-gradient">
                  Configuração
                </h2>
                <p className="mt-1 text-micro uppercase tracking-eyebrow text-muted-foreground/70">
                  Ajustes, memórias e contexto
                </p>
              </div>

              <div className="flex items-center gap-2">
                <SaveStatusBadge
                  status={panelStatus}
                  idleLabel={activeTab === "persona" ? "Autosave" : "Sincronizado"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/8 bg-white/[0.04] p-1">
              {SETTINGS_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-micro font-medium transition-all",
                    activeTab === key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 pt-3">
            {activeTab === "tuning" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
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
                      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        {showTemperature && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">Temperature</p>
                                <p className="text-micro text-muted-foreground">
                                  Controla criatividade e variação de resposta.
                                </p>
                              </div>
                              <span className="text-sm font-mono font-semibold">
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
                              <p className="text-sm font-medium">Max Tokens</p>
                              <p className="text-micro text-muted-foreground">
                                Limita o tamanho máximo da resposta do modelo atual.
                              </p>
                            </div>
                            <span className="text-sm font-mono font-semibold">
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
                              onClick={() => updateParameters({ verbosity: option.id })}
                              className={cn(
                                "rounded-2xl border p-3 text-left transition-colors",
                                parameters.verbosity === option.id
                                  ? "border-primary/30 bg-primary/10 text-foreground"
                                  : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <p className="text-sm font-medium">{option.label}</p>
                              <p className="mt-1 text-micro leading-relaxed">
                                {option.description}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showCodeInterpreter && (
                      <div className="space-y-3">
                        <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                          Ferramentas
                        </h3>
                        <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Code Interpreter</p>
                            <p className="text-micro leading-relaxed text-muted-foreground">
                              Expõe um container Python para o modelo usar quando achar necessário.
                            </p>
                          </div>
                          <Switch
                            checked={parameters.codeInterpreterEnabled}
                            onCheckedChange={(checked) =>
                              updateParameters({ codeInterpreterEnabled: checked })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeMode === "image" && (
                  <div className="space-y-3">
                    <h3 className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />
                      Geração de Imagem
                    </h3>
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Tamanho</span>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value)}
                          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
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
                          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
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
                <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/8 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Memórias ficam no servidor e entram no prompt automaticamente quando estão ativas.
                    Dá pra editar o texto inline sem sair da lista.
                  </p>
                </div>

                <div className="flex gap-2">
                  <textarea
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="Ex: Sempre explique código em detalhe..."
                    rows={2}
                    className="min-h-[72px] flex-1 resize-none rounded-2xl border border-white/10 bg-background/85 p-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && newMemory.trim()) {
                        e.preventDefault();
                        void handleAddMemory();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => void handleAddMemory()}
                    disabled={isCreatingMemory || !newMemory.trim()}
                    className="h-auto min-h-[72px] rounded-2xl bg-gradient-to-r from-green-500 to-blue-500 px-3 text-white hover:opacity-90"
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
                    <div className="rounded-2xl border-2 border-dashed border-white/10 px-4 py-8 text-center">
                      <Brain className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm">Nenhuma memória cadastrada.</p>
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
                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Persona e regras base seguem fixas no servidor. Aqui tu ajusta o contexto
                    extra sobre ti e o jeito que prefere receber as respostas.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Sobre Você
                    </label>
                    <SaveStatusBadge
                      status={isLoaded ? saveStatus : isSaving ? "saving" : "idle"}
                      idleLabel="Autosave"
                    />
                  </div>
                  <textarea
                    value={contextAboutUser}
                    onChange={(e) => updateContextAboutUser(e.target.value)}
                    placeholder="Contexto adicional sobre você..."
                    rows={7}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-background/85 p-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Preferências de Resposta
                  </label>
                  <textarea
                    value={responsePreferences}
                    onChange={(e) => updateResponsePreferences(e.target.value)}
                    placeholder="Como tu prefere que a IA responda..."
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-background/85 p-3 text-sm outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
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
