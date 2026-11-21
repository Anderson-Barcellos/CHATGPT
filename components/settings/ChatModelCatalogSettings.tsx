"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientApiError } from "@/lib/api/errors";
import {
  CHAT_MODEL_PROVIDER_LABELS,
  getChatModel,
  hasKnownOpenAIWebSearch,
  hasOpenAIChatProfile,
  inferChatModelProvider,
  OPENAI_REASONING_EFFORTS,
  type ChatModelRow, type ChatModelCatalog,
} from "@/lib/models/chatModelCatalog";
import {
  chatModelCatalogKey, requestBadgeSuggestions,
  type CatalogBadge, type CatalogCommand, type CatalogUpdate,
  saveChatModel,
  useChatModelCatalog,
} from "@/hooks/useChatModelCatalog";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ReasoningEffort } from "@/types";

type Save = (update: CatalogCommand, revision?: number) => Promise<boolean>;

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

function OpenAIWebSearchOption({ checked, onChange, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="text-xs text-muted-foreground">
      <label className="flex min-h-8 items-center gap-2">
        <input type="checkbox" checked={checked} disabled={disabled}
          onChange={(event) => onChange(event.target.checked)} />
        Busca na web
      </label>
      <p>Ative se a documentação do modelo confirmar suporte a web_search na Responses API.</p>
    </div>
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
  const [webSearch, setWebSearch] = useState<boolean>();
  const modelId = id.trim();
  const provider = inferChatModelProvider(modelId);
  const configurableEffort = provider === "openai" && !hasOpenAIChatProfile(modelId);
  const configurableWebSearch = configurableEffort && !getChatModel(modelId);

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave({
      id, name,
      ...(configurableEffort && { openAIEfforts: efforts }),
      ...(configurableWebSearch && webSearch !== undefined && { webSearchEnabled: webSearch }),
    });
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
          <Input value={id} onChange={(event) => {
            const value = event.target.value;
            if (value.trim() !== modelId) setWebSearch(undefined);
            setId(value);
          }}
            placeholder="gpt-6.2-sol" maxLength={128} required disabled={pending}
            autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
      </div>
      {provider && <p className="text-xs text-muted-foreground">Provedor identificado: {CHAT_MODEL_PROVIDER_LABELS[provider]}</p>}
      {!provider && id.trim() && <p className="text-xs text-muted-foreground">Use um ID de chat da OpenAI ou da Anthropic.</p>}
      {configurableEffort && (
        <OpenAIEffortPicker value={efforts} onChange={setEfforts} disabled={pending} />
      )}
      {configurableWebSearch && (
        <OpenAIWebSearchOption checked={webSearch ?? hasKnownOpenAIWebSearch(modelId)}
          onChange={setWebSearch} disabled={pending} />
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

function ModelRow({ row, revision, pending, onSave }: {
  row: ChatModelRow;
  revision: number;
  pending: boolean;
  onSave: Save;
}) {
  const client = useQueryClient();
  const { model, visible } = row;
  const [draft, setDraft] = useState<string | null>(null);
  const [efforts, setEfforts] = useState<ReasoningEffort[]>([]);
  const [webSearch, setWebSearch] = useState<boolean>();
  const [newId, setNewId] = useState(model.id);
  const [badge, setBadge] = useState(model.badge ?? "");
  const [editRevision, setEditRevision] = useState(revision);
  const draftId = newId.trim();
  const changedId = draftId !== model.id;
  const draftProvider = changedId ? inferChatModelProvider(draftId) : model.provider;
  const configurableEffort = changedId
    ? draftProvider === "openai" && !hasOpenAIChatProfile(draftId)
    : model.provider === "openai" && model.supportsResponsesTools === false;
  const configurableWebSearch = configurableEffort && (!changedId || !getChatModel(draftId));
  const defaultWebSearch = changedId ? hasKnownOpenAIWebSearch(draftId) : model.supportsWebSearch === true;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft === null) return;
    const saved = await onSave({
      id: model.id,
      name: draft, newId: draftId, badge,
      visible,
      ...(configurableEffort && { openAIEfforts: efforts }),
      ...(configurableWebSearch && webSearch !== undefined && { webSearchEnabled: webSearch }),
    }, editRevision);
    if (saved) setDraft(null);
    else setEditRevision(client.getQueryData<ChatModelCatalog>(chatModelCatalogKey)?.revision ?? revision);
  }

  return (
    <form onSubmit={submit} className={rowColumns + " border-t border-border/70 px-3 py-2.5"}>
      <div className="min-w-0">
        {draft === null
          ? <p className="break-words text-sm font-medium">{model.name}</p>
          : <Input aria-label="Editar nome no seletor" value={draft}
              onChange={(event) => setDraft(event.target.value)}
              required maxLength={80} disabled={pending} />}
        <p className="text-xs text-muted-foreground">{draft === null ? CHAT_MODEL_PROVIDER_LABELS[model.provider]
          : draftProvider ? CHAT_MODEL_PROVIDER_LABELS[draftProvider] : "Confira o ID"}</p>
      </div>
      <div className="min-w-0">
        {draft === null ? <p className="break-all font-mono text-xs leading-5">{model.id}</p>
          : <Input aria-label="Editar ID do modelo" value={newId} required maxLength={128} spellCheck={false}
              disabled={pending} onChange={event => {
                const value = event.target.value;
                if (value.trim() !== draftId) {
                  setEfforts(value.trim() === model.id ? model.supportedReasoningEfforts ?? [] : []);
                  setWebSearch(undefined);
                }
                setNewId(value);
              }} />}
        {draft === null && model.badge && <span className="text-xs">{model.badge}</span>}
        {!visible && <p className="text-xs text-muted-foreground">Oculto no seletor</p>}
      </div>
      {draft !== null && <label className="col-span-2 text-xs">Rótulo no seletor
        <Input value={badge} maxLength={32} disabled={pending} onChange={event => setBadge(event.target.value)} />
      </label>}
      {draft !== null && configurableEffort && (
        <div className="col-span-2">
          <OpenAIEffortPicker value={efforts} onChange={setEfforts} disabled={pending} />
        </div>
      )}
      {draft !== null && configurableWebSearch && (
        <div className="col-span-2">
          <OpenAIWebSearchOption checked={webSearch ?? defaultWebSearch} onChange={setWebSearch} disabled={pending} />
        </div>
      )}
      <div className="col-span-2 flex flex-wrap gap-x-1 gap-y-1">
        {draft === null ? (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              aria-label={"Editar " + model.name} onClick={(event) => {
                event.preventDefault();
                setEfforts(model.supportedReasoningEfforts ?? []);
                setWebSearch(undefined);
                setNewId(model.id);
                setBadge(model.badge ?? "");
                setEditRevision(revision);
                setDraft(model.name);
              }}>Editar</Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              aria-label={(visible ? "Ocultar " : "Mostrar ") + model.name}
              onClick={() => void onSave({ id: model.id, name: model.name, visible: !visible })}>
              {visible ? "Ocultar" : "Mostrar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={"Excluir " + model.name}
              onClick={() => {
                if (window.confirm("Excluir " + model.name + " (" + model.id + ") do catálogo?")) {
                  void onSave({ action: "delete", id: model.id });
                }
              }}>Excluir</Button>
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

  const [preview, setPreview] = useState<{ revision: number; items: (CatalogBadge & { selected: boolean })[] } | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  async function suggest() {
    if (!catalog || pending) return;
    setPending(true);
    setFeedback(null);
    setPreview(null);
    try {
      const result = await requestBadgeSuggestions(catalog.revision);
      if (result.suggestions.length) {
        setPreview({ revision: result.revision, items: result.suggestions.map(item => ({ ...item, selected: true })) });
      } else setFeedback({ text: "Sem sugestões para este catálogo.", error: false });
    } catch (error) {
      if (error instanceof ClientApiError && error.status === 409) await query.refetch();
      setFeedback({ text: error instanceof Error ? error.message : "Falha ao sugerir rótulos.", error: true });
    } finally {
      setPending(false);
    }
  }

  async function save(update: CatalogCommand, revision = catalog?.revision) {
    if (!catalog || pending || revision === undefined) return false;
    setPending(true);
    setFeedback(null);
    try {
      await client.cancelQueries({ queryKey: chatModelCatalogKey });
      const saved = await saveChatModel(update, revision);
      const replacement = "newId" in update && update.newId ? { from: update.id, to: update.newId } : undefined;
      useSettingsStore.getState().setChatModelCatalog(saved, replacement);
      client.setQueryData(chatModelCatalogKey, saved);
      if (!("action" in update) && update.visible === undefined) setAdding(false);
      if ("action" in update && update.action === "badges") setPreview(null);
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

  const ids = catalog.rows.map(row => row.model.id);
  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    const reordered = [...ids];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);
    void save({ action: "reorder", ids: reordered });
  }

  function updatePreview(id: string, changes: Partial<{ selected: boolean; badge: string }>) {
    setPreview(current => current && { ...current,
      items: current.items.map(item => item.id === id ? { ...item, ...changes } : item) });
  }

  return (
    <section aria-label="Catálogo de modelos do chat" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Escolha quais modelos aparecem no seletor do chat.</p>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={suggest}>Sugerir rótulos</Button>
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
      {preview && <fieldset className="space-y-2 rounded-xl border p-3" disabled={pending}>
        <legend className="px-1 text-sm font-medium">Revisar sugestões</legend>
        {preview.items.map(item => {
          const model = catalog.rows.find(row => row.model.id === item.id)?.model;
          return <div key={item.id} className={rowColumns}>
            <label className="min-w-0 break-words text-sm"><input type="checkbox" checked={item.selected}
              onChange={event => updatePreview(item.id, { selected: event.target.checked })} /> {model?.name ?? item.id}
              <span className="block text-xs text-muted-foreground">Atual: {model?.badge || "Sem rótulo"}</span></label>
            <Input aria-label={"Sugestão para " + (model?.name ?? item.id)} value={item.badge} maxLength={32}
              onChange={event => updatePreview(item.id, { badge: event.target.value })} />
          </div>;
        })}
        {preview.revision !== catalog.revision && <p role="alert">O catálogo mudou. Gere novas sugestões.</p>}
        <Button type="button" size="sm" disabled={!preview.items.some(item => item.selected) || preview.revision !== catalog.revision}
          onClick={() => void save({ action: "badges", badges: preview.items.filter(item => item.selected)
            .map(({ id, badge }) => ({ id, badge })) }, preview.revision)}>Aplicar selecionados</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
      </fieldset>}
      {pending && <p role="status" className="text-sm text-muted-foreground">Aguarde…</p>}
      {feedback && (
        <p role={feedback.error ? "alert" : "status"}
          className={"text-sm " + (feedback.error ? "text-destructive" : "text-muted-foreground")}>{feedback.text}</p>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className={rowColumns + " bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground"}>
          <span>Nome no seletor</span>
          <span>ID do modelo</span>
        </div>
        {catalog.rows.map((row, index) => (
          <div key={row.model.id} data-catalog-id={row.model.id}
            className={target === row.model.id ? "ring-2 ring-inset ring-primary" : ""}>
            <div className="flex items-center gap-1 px-2 pt-1">
              <button type="button" disabled={pending} aria-label={"Arrastar " + row.model.name}
                className="touch-none cursor-grab rounded p-2 active:cursor-grabbing"
                onPointerDown={event => {
                  if (!event.isPrimary || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setTarget(row.model.id);
                }}
                onPointerMove={event => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-catalog-id]");
                  setTarget(hovered?.dataset.catalogId ?? null);
                  hovered?.scrollIntoView({ block: "nearest" });
                }}
                onLostPointerCapture={() => setTarget(null)}
                onPointerUp={event => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-catalog-id]");
                  move(index, ids.indexOf(hovered?.dataset.catalogId ?? ""));
                  setTarget(null);
                }}><GripVertical size={18} /></button>
              <Button type="button" size="sm" variant="ghost" disabled={pending || index === 0}
                aria-label={"Mover para cima " + row.model.name} onClick={() => move(index, index - 1)}><ArrowUp size={16} /></Button>
              <Button type="button" size="sm" variant="ghost" disabled={pending || index === ids.length - 1}
                aria-label={"Mover para baixo " + row.model.name} onClick={() => move(index, index + 1)}><ArrowDown size={16} /></Button>
            </div>
            <ModelRow row={row} revision={catalog.revision} pending={pending} onSave={save} />
          </div>
        ))}
      </div>
    </section>
  );
}
