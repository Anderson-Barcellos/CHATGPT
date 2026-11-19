"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientApiError } from "@/lib/api/errors";
import {
  CHAT_MODEL_PROVIDER_LABELS,
  hasOpenAIChatProfile,
  inferChatModelProvider,
  OPENAI_REASONING_EFFORTS,
  type ChatModelRow,
} from "@/lib/models/chatModelCatalog";
import {
  chatModelCatalogKey,
  saveChatModel,
  useChatModelCatalog,
} from "@/hooks/useChatModelCatalog";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ReasoningEffort } from "@/types";

type CatalogUpdate = Omit<Parameters<typeof saveChatModel>[0], "revision">;

const rowColumns = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2";

function OpenAIEffortPicker({ value, onChange, disabled }: {
  value: ReasoningEffort[];
  onChange: (efforts: ReasoningEffort[]) => void;
  disabled: boolean;
}) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1">Níveis de raciocínio (opcional)</summary>
      <p className="my-2">Marque os níveis que a documentação do modelo confirma.</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {OPENAI_REASONING_EFFORTS.map((effort) => (
          <label key={effort} className="flex min-h-8 items-center gap-1.5 font-mono">
            <input type="checkbox" checked={value.includes(effort)} disabled={disabled}
              onChange={(event) =>
                onChange(event.target.checked ? [...value, effort] : value.filter((choice) => choice !== effort))
              } />
            {effort}
          </label>
        ))}
      </div>
    </details>
  );
}

function AddModelForm({ onSave, onCancel, pending }: {
  onSave: (update: CatalogUpdate) => Promise<boolean>;
  onCancel: () => void;
  pending: boolean;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [efforts, setEfforts] = useState<ReasoningEffort[]>([]);
  const provider = inferChatModelProvider(id.trim());
  const configurableEffort = provider === "openai" && !hasOpenAIChatProfile(id.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave({ id, name, ...(configurableEffort && { openAIEfforts: efforts }) });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border p-3">
      <div className={rowColumns}>
        <label className="min-w-0 space-y-1 text-xs">
          <span>Nome no seletor</span>
          <Input value={name} onChange={(event) => setName(event.target.value)}
            placeholder="GPT-6.2 Sol" maxLength={80} required disabled={pending} />
        </label>
        <label className="min-w-0 space-y-1 text-xs">
          <span>ID do modelo</span>
          <Input value={id} onChange={(event) => setId(event.target.value)}
            placeholder="gpt-6.2-sol" maxLength={128} required disabled={pending}
            autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
      </div>
      {provider && <p className="text-xs text-muted-foreground">Provedor identificado: {CHAT_MODEL_PROVIDER_LABELS[provider]}</p>}
      {!provider && id.trim() && <p className="text-xs text-muted-foreground">Use um ID de chat da OpenAI ou da Anthropic.</p>}
      {configurableEffort && (
        <OpenAIEffortPicker value={efforts} onChange={setEfforts} disabled={pending} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || !provider || !name.trim()}>
          {pending ? "Verificando…" : "Verificar e adicionar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}

function ModelRow({ row, pending, onSave }: {
  row: ChatModelRow;
  pending: boolean;
  onSave: (update: CatalogUpdate) => Promise<boolean>;
}) {
  const { model, visible } = row;
  const [draft, setDraft] = useState<string | null>(null);
  const [efforts, setEfforts] = useState<ReasoningEffort[]>([]);
  const configurableEffort = model.provider === "openai" && model.supportsResponsesTools === false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft === null) return;
    const saved = await onSave({
      id: model.id,
      name: draft,
      visible,
      ...(configurableEffort && { openAIEfforts: efforts }),
    });
    if (saved) setDraft(null);
  }

  return (
    <form onSubmit={submit} className={rowColumns + " border-t border-border/70 px-3 py-2.5"}>
      <div className="min-w-0">
        {draft === null
          ? <p className="break-words text-sm font-medium">{model.name}</p>
          : <Input aria-label="Editar nome no seletor" value={draft}
              onChange={(event) => setDraft(event.target.value)}
              required maxLength={80} disabled={pending} />}
        <p className="text-xs text-muted-foreground">{CHAT_MODEL_PROVIDER_LABELS[model.provider]}</p>
      </div>
      <div className="min-w-0">
        <p className="break-all font-mono text-xs leading-5">{model.id}</p>
        {!visible && <p className="text-xs text-muted-foreground">Oculto no seletor</p>}
      </div>
      {draft !== null && configurableEffort && (
        <div className="col-span-2">
          <OpenAIEffortPicker value={efforts} onChange={setEfforts} disabled={pending} />
        </div>
      )}
      <div className="col-span-2 flex flex-wrap gap-x-1 gap-y-1">
        {draft === null ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              aria-label={"Editar " + model.name} onClick={(event) => {
                event.preventDefault();
                setEfforts(model.supportedReasoningEfforts ?? []);
                setDraft(model.name);
              }}>Editar</Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              aria-label={(visible ? "Ocultar " : "Mostrar ") + model.name}
              onClick={() => void onSave({ id: model.id, name: model.name, visible: !visible })}>
              {visible ? "Ocultar" : "Mostrar"}
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" size="sm" disabled={pending || !draft.trim()}>Salvar</Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              onClick={() => setDraft(null)}>Cancelar</Button>
          </>
        )}
      </div>
    </form>
  );
}

export function ChatModelCatalogSettings() {
  const query = useChatModelCatalog();
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const catalog = query.data;

  async function save(update: CatalogUpdate) {
    if (!catalog || pending) return false;
    setPending(true);
    setFeedback(null);
    try {
      await client.cancelQueries({ queryKey: chatModelCatalogKey });
      const saved = await saveChatModel({ ...update, revision: catalog.revision });
      useSettingsStore.getState().setChatModelCatalog(saved);
      client.setQueryData(chatModelCatalogKey, saved);
      if (update.visible === undefined) setAdding(false);
      setFeedback({ text: "Catálogo atualizado.", error: false });
      return true;
    } catch (error) {
      if (error instanceof ClientApiError && error.status === 409) await query.refetch();
      setFeedback({
        text: error instanceof Error ? error.message : "Não consegui salvar o modelo.",
        error: true,
      });
      return false;
    } finally {
      setPending(false);
    }
  }

  if (!catalog) {
    return query.isError ? (
      <div className="space-y-2">
        <p role="alert" className="text-sm">Não consegui carregar o catálogo de modelos.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    ) : <p role="status" className="text-sm text-muted-foreground">Carregando modelos…</p>;
  }

  return (
    <section aria-label="Catálogo de modelos do chat" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Escolha quais modelos aparecem no seletor do chat.</p>
        {!adding && (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Adicionar modelo
          </Button>
        )}
      </div>
      {adding && (
        <AddModelForm pending={pending} onSave={save} onCancel={() => {
          setAdding(false);
          setFeedback(null);
        }} />
      )}
      {feedback && (
        <p role={feedback.error ? "alert" : "status"}
          className={"text-sm " + (feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className={rowColumns + " bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground"}>
          <span>Nome no seletor</span>
          <span>ID do modelo</span>
        </div>
        {catalog.rows.map((row) => (
          <ModelRow key={row.model.id} row={row} pending={pending} onSave={save} />
        ))}
      </div>
    </section>
  );
}
