"use client";

import { useCallback } from "react";
import { Command } from "cmdk";
import {
  Activity,
  Bot,
  Brain,
  CalendarDays,
  Check,
  FilePen,
  HelpCircle,
  MessageSquare,
  Plus,
  Settings,
  StickyNote,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCommandPaletteContext } from "@/components/command/CommandPaletteProvider";
import { getChatModels } from "@/lib/models/modelConfig";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import type { ReasoningEffort } from "@/types";

const REASONING_LEVELS: { label: string; value: ReasoningEffort; hint: string }[] = [
  { label: "Sem raciocínio", value: "none", hint: "Rápido" },
  { label: "Raciocínio baixo", value: "low", hint: "Low" },
  { label: "Raciocínio médio", value: "medium", hint: "Medium" },
  { label: "Raciocínio alto", value: "high", hint: "High" },
  { label: "Raciocínio máximo", value: "xhigh", hint: "xHigh" },
];

const RESPONSE_MODES = [
  { label: "Modo Chat", value: "default", icon: MessageSquare },
  { label: "Deepsearch Medium", value: "deepsearch_medium", icon: FilePen },
  { label: "Deepsearch High", value: "deepsearch_high", icon: FilePen },
  { label: "Modo Quiz", value: "quiz", icon: HelpCircle },
] as const;

export function CommandPalette() {
  const { open, setOpen } = useCommandPaletteContext();
  const { parameters, updateParameters } = useSettingsStore();
  const { setActivePanelTab } = useUIStore();
  const { setActiveConversationId } = useChatStore();

  const chatModels = getChatModels();

  const run = useCallback(
    (fn: () => void) => {
      fn();
      setOpen(false);
    },
    [setOpen],
  );

  const handleNewConversation = useCallback(() => {
    run(() => setActiveConversationId(null));
  }, [run, setActiveConversationId]);

  const handleSetMode = useCallback((mode: string) => {
    window.dispatchEvent(new CustomEvent("gaucho:set-response-mode", { detail: { mode } }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 shadow-2xl [&>button]:hidden"
        style={{ zIndex: 300, maxWidth: "560px", width: "100%" }}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-nano [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-label [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b border-[color:var(--gc-border-soft)] px-3">
            <Command.Input
              placeholder="Buscar comando..."
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[380px] overflow-y-auto overflow-x-hidden p-1.5">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum comando encontrado.
            </Command.Empty>

            {/* Conversa */}
            <Command.Group heading="Conversa">
              <Command.Item
                onSelect={handleNewConversation}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Plus className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Nova conversa</span>
                <kbd className="text-nano text-muted-foreground">⌘⇧N</kbd>
              </Command.Item>
            </Command.Group>

            {/* Modelo */}
            <Command.Group heading="Modelo">
              {chatModels.map((model) => (
                <Command.Item
                  key={model.id}
                  value={`modelo ${model.name} ${model.id}`}
                  onSelect={() => run(() => updateParameters({ model: model.id }))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Bot className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 min-w-0 truncate">{model.name}</span>
                  {parameters.model === model.id && (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Raciocínio */}
            <Command.Group heading="Raciocínio">
              {REASONING_LEVELS.map(({ label, value, hint }) => (
                <Command.Item
                  key={value}
                  value={`raciocínio ${label} ${value}`}
                  onSelect={() => run(() => updateParameters({ reasoningEffort: value }))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Brain className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  {parameters.reasoningEffort === value ? (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  ) : (
                    <span className="text-nano text-muted-foreground">{hint}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Modo de resposta */}
            <Command.Group heading="Modo">
              {RESPONSE_MODES.map(({ label, value, icon: Icon }) => (
                <Command.Item
                  key={value}
                  value={`modo ${label} ${value}`}
                  onSelect={() => run(() => handleSetMode(value))}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Painel */}
            <Command.Group heading="Painel">
              <Command.Item
                value="painel atividade notas da rodada"
                onSelect={() => run(() => setActivePanelTab("activity"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Activity className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Ver Notas da rodada</span>
              </Command.Item>
              <Command.Item
                value="painel notas capturas locais workspace"
                onSelect={() => run(() => setActivePanelTab("notes"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <StickyNote className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Ver Capturas locais</span>
              </Command.Item>
              <Command.Item
                value="painel agenda calendario google eventos rascunhos"
                onSelect={() => run(() => setActivePanelTab("calendar"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Ver Agenda</span>
              </Command.Item>
            </Command.Group>

            {/* Geral */}
            <Command.Group heading="Geral">
              <Command.Item
                value="configurações settings preferences"
                onSelect={() =>
                  run(() =>
                    window.dispatchEvent(new CustomEvent("gaucho:open-settings"))
                  )
                }
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Settings className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Configurações</span>
                <kbd className="text-nano text-muted-foreground">⌘⇧,</kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
