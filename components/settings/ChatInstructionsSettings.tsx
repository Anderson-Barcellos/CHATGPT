"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { appendChatModeInstructions } from "@/lib/chat/chatModeInstructions";
import { buildSystemPrompt, MEMORY_TOOL_INSTRUCTIONS } from "@/lib/openai/contextBuilder";
import { hydratePersona } from "@/lib/persona/persona";
import { getChatInstructions, getInitialChatInstructions } from "@/lib/prompts/personaPrompt";
import { BASE_SYSTEM_PROMPT } from "@/lib/prompts/systemPrompt";
import { apiUrl } from "@/lib/utils";
import type { ResponseMode } from "@/types";

export interface ChatInstructionsDraft {
  text: string;
  previous: string | null;
}

const personaKey = ["chat-instructions-persona"] as const;
const modes: { id: string; mode: ResponseMode; label: string; sample?: string }[] = [
  { id: "chat", mode: "default", label: "Chat" },
  { id: "document", mode: "document", label: "Documento" },
  { id: "clinical", mode: "document", label: "Documento · laudo", sample: "Redige um laudo" },
  { id: "deepsearch-medium", mode: "deepsearch_medium", label: "Deepsearch Medium" },
  { id: "deepsearch-high", mode: "deepsearch_high", label: "Deepsearch High" },
  { id: "quiz", mode: "quiz", label: "Quiz" },
];
const protectedInstructions = [BASE_SYSTEM_PROMPT, MEMORY_TOOL_INSTRUCTIONS].join("\n\n---\n\n");
const promptArea = "gc-refined-soft-surface w-full resize-y rounded-xl border p-3 font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-primary/20";

class StaleChatInstructionsError extends Error {}

async function copyPrompt(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Texto copiado.");
  } catch {
    toast.error("Não consegui copiar. Seleciona o texto para copiar manualmente.");
  }
}

export function ChatInstructionsSettings({
  draft,
  setDraft,
  extraInstructions,
}: {
  draft: ChatInstructionsDraft | null;
  setDraft: Dispatch<SetStateAction<ChatInstructionsDraft | null>>;
  extraInstructions: string;
}) {
  const client = useQueryClient();
  const [previewMode, setPreviewMode] = useState(modes[0]);
  const isSaving = useIsMutating({ mutationKey: personaKey }) > 0;
  const persona = useQuery({
    queryKey: personaKey,
    queryFn: async ({ signal }) => {
      const response = await fetch(apiUrl("/api/persona"), { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Não consegui carregar as instruções.");
      return hydratePersona(await response.json());
    },
  });
  const save = useMutation({
    mutationKey: personaKey,
    mutationFn: async (pending: ChatInstructionsDraft) => {
      const response = await fetch(apiUrl("/api/persona"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInstructions: pending.text, previousChatInstructions: pending.previous }),
      });
      if (response.status === 409) throw new StaleChatInstructionsError("Outra sessão salvou uma versão mais recente.");
      if (!response.ok) throw new Error("Não consegui salvar. Teu rascunho segue no editor.");
      return hydratePersona(await response.json());
    },
    onSuccess: async (data, savedDraft) => {
      await client.cancelQueries({ queryKey: personaKey });
      client.setQueryData(personaKey, data);
      setDraft(current => current === savedDraft ? null : current);
      toast.success("Instruções salvas para as próximas respostas.");
    },
  });

  if (!persona.data) {
    return persona.isError ? (
      <div className="space-y-2 text-sm" role="status">
        <p>Não consegui carregar as instruções do Gaúcho.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void persona.refetch()}>Tentar novamente</Button>
      </div>
    ) : <p role="status" className="text-sm text-muted-foreground">Carregando instruções…</p>;
  }

  const saved = persona.data;
  const savedText = getChatInstructions(saved);
  const text = draft?.text ?? savedText;
  const dirty = text !== savedText;
  const stale = save.error instanceof StaleChatInstructionsError
    || (draft !== null && draft.previous !== (saved.chatInstructions ?? null));
  const preview = appendChatModeInstructions(
    buildSystemPrompt(
      extraInstructions,
      { ...saved, importedBiography: undefined, contextAboutUser: "", chatInstructions: text },
      [], [], previewMode.mode === "default",
    ).systemMessage,
    previewMode.mode,
    previewMode.sample,
  );

  function edit(next: string) {
    if (save.error && !stale) save.reset();
    setDraft({ text: next, previous: draft ? draft.previous : saved.chatInstructions ?? null });
  }

  async function reloadSaved() {
    const result = await persona.refetch();
    if (result.isSuccess) {
      save.reset();
      setDraft(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="chat-instructions-title">
      <div className="space-y-2">
        <h3 id="chat-instructions-title" className="text-base font-semibold">Instruções do Gaúcho</h3>
        <label htmlFor="chat-persona" className="text-sm font-medium">Persona e instruções</label>
        <p id="chat-persona-help" className="text-xs text-muted-foreground">
          Ajusta a voz, o estilo e as preferências do chat. Vale pedir um gauchês bem caricato.
        </p>
        <textarea id="chat-persona" aria-describedby="chat-persona-help" value={text}
          onChange={(event) => edit(event.target.value)} disabled={isSaving} rows={8}
          className={`${promptArea} !text-base md:!text-sm`} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={!dirty || stale || isSaving}
            onClick={() => draft && save.mutate(draft)}>
            {isSaving ? "Salvando…" : "Salvar instruções"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={stale || isSaving}
            onClick={() => edit(getInitialChatInstructions(saved))}>
            Restaurar texto inicial
          </Button>
        </div>
        {stale ? (
          <div className="space-y-2 text-xs text-destructive" role="alert">
            <p>Outra sessão salvou uma versão mais recente. Podes copiar teu rascunho antes de recarregar.</p>
            <Button type="button" size="sm" variant="outline" disabled={persona.isFetching}
              onClick={() => void reloadSaved()}>Descartar rascunho e recarregar</Button>
          </div>
        ) : save.error ? <p role="alert" className="text-xs text-destructive">{save.error.message}</p> : null}
      </div>

      <details className="gc-refined-soft-surface rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          <LockKeyhole aria-hidden="true" className="mr-1.5 inline size-3.5" />Regras do sistema
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Inclui as instruções das ferramentas de memória, disponíveis no modo Chat.</p>
          <textarea aria-label="Regras do sistema" value={protectedInstructions} readOnly rows={8} className={promptArea} />
          <Button type="button" size="sm" variant="outline" onClick={() => void copyPrompt(protectedInstructions)}>
            <Copy className="size-3.5" />Copiar regras
          </Button>
        </div>
      </details>

      <details className="gc-refined-soft-surface rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">Prévia do prompt</summary>
        <div className="mt-3 space-y-2">
          <label htmlFor="chat-prompt-mode" className="text-xs font-medium">Modo da prévia</label>
          <select id="chat-prompt-mode" value={previewMode.id} className="gc-refined-soft-surface block w-full rounded-lg border p-2 text-base md:text-sm"
            onChange={(event) => setPreviewMode(modes.find((mode) => mode.id === event.target.value) ?? modes[0])}>
            {modes.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            {dirty && "Prévia com o rascunho. "}O contexto pessoal e os trechos de conversas entram conforme a mensagem.
          </p>
          <textarea aria-label="Prévia do prompt" value={preview} readOnly rows={10} className={promptArea} />
          <Button type="button" size="sm" variant="outline" onClick={() => void copyPrompt(preview)}>
            <Copy className="size-3.5" />Copiar prévia
          </Button>
        </div>
      </details>
    </section>
  );
}
