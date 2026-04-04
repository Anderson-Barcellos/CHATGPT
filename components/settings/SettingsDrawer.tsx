"use client";

import { useState } from "react";
import { X, Brain, Sliders, User, Plus, Trash2, Sparkles, Image as ImageIcon } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemories } from "@/hooks/useMemories";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import { toast } from "sonner";
import {
  MODELS,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

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

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { parameters, updateParameters } = useSettingsStore();
  const { activeMode, imageQuality, imageSize, setImageQuality, setImageSize } = useUIStore();
  const { memories = [], addMemory, updateMemory, deleteMemory } = useMemories();
  const {
    contextAboutUser,
    responsePreferences,
    updateContextAboutUser,
    updateResponsePreferences,
    saveContextAboutUser,
    isSaving,
  } = useCustomInstructions();
  const [activeTab, setActiveTab] = useState<"tuning" | "memory" | "persona">("tuning");
  const [newMemory, setNewMemory] = useState("");

  const currentModel = MODELS[parameters.model];
  const showTemperature = modelSupportsTemperature(parameters.model);
  const showVerbosity = modelSupportsVerbosity(parameters.model);
  const showCodeInterpreter = modelSupportsCodeInterpreter(parameters.model);
  const maxTokensLimit = currentModel?.maxOutput ?? parameters.maxOutputTokens;
  const minTokensLimit = Math.min(256, maxTokensLimit);

  const handleAddMemory = () => {
    if (newMemory.trim()) {
      addMemory({
        content: newMemory,
        category: "personal",
        isActive: true,
        priority: 0,
      });
      setNewMemory("");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-96 z-50 flex flex-col",
        "bg-background/95 backdrop-blur-xl border-l border-border shadow-2xl",
        "animate-in slide-in-from-right duration-300"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
            Configuração
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-border p-1 mx-4 mt-4 bg-muted/30 rounded-lg">
          {([
            { key: "tuning", label: "Tuning", icon: Sliders },
            { key: "memory", label: "Memória", icon: Brain },
            { key: "persona", label: "Persona", icon: User },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 p-2 text-xs font-medium rounded-md transition-all",
                activeTab === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "tuning" && (
            <div className="space-y-6">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                <div className="flex items-center gap-2 font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-4 w-4" />
                  {currentModel?.name || parameters.model}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentModel?.description || "Modelo selecionado"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
                  Troque o modelo nos dropdowns da área de input.
                </p>
              </div>

              {activeMode === "chat" && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tuning do Modelo
                    </h3>
                    <div className="bg-muted/40 rounded-xl p-4 space-y-4">
                      {showTemperature && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">Temperature</p>
                              <p className="text-[11px] text-muted-foreground">
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
                            onValueChange={([value]) =>
                              updateParameters({ temperature: value })
                            }
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Max Tokens</p>
                            <p className="text-[11px] text-muted-foreground">
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
                        <p className="text-[11px] text-muted-foreground">
                          Limite do modelo: {maxTokensLimit.toLocaleString()} tokens.
                        </p>
                      </div>
                    </div>
                  </div>

                  {showVerbosity && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Verbosity
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {VERBOSITY_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateParameters({ verbosity: option.id })}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-colors",
                              parameters.verbosity === option.id
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <p className="text-sm font-medium">{option.label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed">
                              {option.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showCodeInterpreter && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Ferramentas
                      </h3>
                      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Code Interpreter</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Expõe um container Python para o modelo usar quando achar necessário.
                            Pode aumentar custo e latência em tarefas analíticas.
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
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" />
                    Geração de Imagem
                  </h3>
                  <div className="space-y-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Tamanho</span>
                      <select
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {IMAGE_SIZES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-muted-foreground">Qualidade</span>
                      <select
                        value={imageQuality}
                        onChange={(e) => setImageQuality(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {IMAGE_QUALITIES.map((q) => (
                          <option key={q.id} value={q.id}>{q.label}</option>
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder="Ex: Sempre explique código em detalhe..."
                  className="flex-1 bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMemory.trim()) handleAddMemory();
                  }}
                />
                <button
                  onClick={handleAddMemory}
                  className="p-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                {memories.length === 0 ? (
                  <div className="text-center py-8 opacity-50 border-2 border-dashed border-border rounded-lg">
                    <Brain className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Nenhuma memória cadastrada.</p>
                    <p className="text-xs mt-1">Memórias são injetadas no prompt automaticamente.</p>
                  </div>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="group flex items-start gap-3 bg-muted/40 p-3 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
                    >
                      <input
                        type="checkbox"
                        checked={m.isActive}
                        onChange={() => updateMemory(m.id, { isActive: !m.isActive })}
                        className="mt-1 accent-primary"
                      />
                      <p className={cn(
                        "flex-1 text-sm leading-relaxed",
                        !m.isActive && "opacity-50 line-through"
                      )}>
                        {m.content}
                      </p>
                      <button
                        onClick={() => deleteMemory(m.id)}
                        className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "persona" && (
            <div className="space-y-6">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                <p className="text-xs text-muted-foreground">
                  Persona, regras de formato e comportamento estão fixos no servidor.
                  Aqui você pode adicionar contexto extra sobre você.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Sobre Você
                </label>
                <textarea
                  value={contextAboutUser}
                  onChange={(e) => updateContextAboutUser(e.target.value)}
                  placeholder="Contexto adicional sobre você (opcional)..."
                  rows={6}
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Preferências de Resposta
                </label>
                <textarea
                  value={responsePreferences}
                  onChange={(e) => updateResponsePreferences(e.target.value)}
                  placeholder="Como tu prefere que a IA responda (opcional)..."
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
                />
              </div>

              <button
                onClick={async () => {
                  const ok = await saveContextAboutUser();
                  if (ok) toast.success("Salvo no servidor!");
                  else toast.error("Erro ao salvar.");
                }}
                disabled={isSaving}
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-medium transition-all",
                  "bg-gradient-to-r from-green-500 to-blue-500 text-white",
                  "hover:opacity-90 disabled:opacity-50"
                )}
              >
                {isSaving ? "Salvando..." : "Salvar no servidor"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
