"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LoaderCircle,
  PanelRightClose,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgendaPanelV2 } from "@/components/workspace-v2/AgendaPanelV2";
import { useNotesContext } from "@/components/workspace-v2/NotesProvider";
import { WorkspaceCapturesPanelV2 } from "@/components/workspace-v2/WorkspaceCapturesPanelV2";
import { useConversations } from "@/hooks/useConversations";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";
import { saveConversationWorkspace } from "@/lib/storage/conversations";
import { useChatStore } from "@/stores/chatStore";
import { useUIStore } from "@/stores/uiStore";
import type {
  ActivePanelTab,
  ConversationWorkspace,
  ConversationWorkspaceNotes,
} from "@/types";

interface NotesDraft {
  objective: string;
  body: string;
  nextStepsText: string;
}

const EMPTY_NOTES_DRAFT: NotesDraft = {
  objective: "",
  body: "",
  nextStepsText: "",
};

function toDate(value: Date | string | undefined): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function parseNextStepsText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function notesToDraft(notes: ConversationWorkspaceNotes | undefined): NotesDraft {
  if (!notes) return EMPTY_NOTES_DRAFT;

  return {
    objective: notes.objective ?? "",
    body: notes.body ?? "",
    nextStepsText: (notes.nextSteps ?? []).join("\n"),
  };
}

export function ContextPanelV2() {
  const queryClient = useQueryClient();
  const {
    activePanelTab,
    setActivePanelTab,
  } = useUIStore();
  const { _register } = useNotesContext();
  const { activeConversationId } = useChatStore();
  const { conversations = [] } = useConversations();

  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesDraft, setNotesDraft] = useState<NotesDraft>(EMPTY_NOTES_DRAFT);
  const previousConversationIdRef = useRef<string | null>(null);
  const notesDraftBodyRef = useRef(notesDraft.body);

  useEffect(() => {
    notesDraftBodyRef.current = notesDraft.body;
  }, [notesDraft.body]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === activeConversationId) ??
      null,
    [activeConversationId, conversations]
  );

  const persistedNotes = activeConversation?.workspace?.notes;
  const notesUpdatedAtKey = persistedNotes?.updatedAt
    ? toDate(persistedNotes.updatedAt).toISOString()
    : "none";

  useEffect(() => {
    const currentConversationId = activeConversationId ?? null;

    if (previousConversationIdRef.current !== currentConversationId) {
      previousConversationIdRef.current = currentConversationId;
      setNotesDraft(notesToDraft(persistedNotes));
      setNotesDirty(false);
      return;
    }

    if (!notesDirty) {
      setNotesDraft(notesToDraft(persistedNotes));
    }
  }, [activeConversationId, notesDirty, notesUpdatedAtKey, persistedNotes]);

  const handleSaveNotes = useCallback(async () => {
    if (!activeConversationId) {
      toast.error("Selecione uma conversa antes de salvar notas.");
      return;
    }

    const workspacePayload: ConversationWorkspace = {
      notes: {
        objective: notesDraft.objective.trim(),
        body: notesDraft.body.trim(),
        nextSteps: parseNextStepsText(notesDraft.nextStepsText),
        updatedAt: new Date(),
      },
    };

    setIsSavingNotes(true);

    try {
      await withConversationPersistenceRetry(() =>
        saveConversationWorkspace(activeConversationId, workspacePayload)
      );
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(activeConversationId),
      });
      await queryClient.invalidateQueries({
        queryKey: conversationKeys.lists(),
      });
      setNotesDraft(notesToDraft(workspacePayload.notes));
      setNotesDirty(false);
      toast.success("Notas salvas na conversa.");
    } catch (error) {
      console.error("[ContextPanelV2] Falha ao salvar notas:", error);
      toast.error("Nao consegui salvar as notas agora.");
    } finally {
      setIsSavingNotes(false);
    }
  }, [activeConversationId, notesDraft, queryClient]);

  const updateNotesField = useCallback(
    (field: keyof NotesDraft, value: string) => {
      setNotesDraft((current) => ({ ...current, [field]: value }));
      setNotesDirty(true);
    },
    []
  );

  useEffect(() => {
    return _register((text, msgId) => {
      const snippet = `\n\n---\n> ${text}\n> _Fonte: #${msgId.slice(0, 8)}_\n`;
      updateNotesField("body", notesDraftBodyRef.current + snippet);
    });
  }, [_register, updateNotesField]);

  return (
    <div className="flex h-full flex-col">
      <div className="gc-clinical-section-header flex items-center justify-between border-b border-[color:var(--gc-border)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)] xl:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Painel operacional</h2>
          <p className="text-nano uppercase tracking-label text-muted-foreground">
            Contexto
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("gaucho:close-context-panel"));
          }}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <Tabs
        value={activePanelTab}
        onValueChange={(v) => setActivePanelTab(v as ActivePanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="gc-clinical-section-header border-b border-[color:var(--gc-border)] px-[var(--gc-mobile-context-header-x)] py-[var(--gc-mobile-context-header-y)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Workspace</h2>
              <p className="text-nano uppercase tracking-label text-muted-foreground">
                acompanhamento em tempo real
              </p>
            </div>
          </div>
          <TabsList className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-panel-strong)] p-1">
            <TabsTrigger value="activity" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Atividade
            </TabsTrigger>
            <TabsTrigger value="notes" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Notas
            </TabsTrigger>
            <TabsTrigger value="calendar" className="h-8 rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agenda
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-[var(--gc-mobile-panel-content-gap)] p-[var(--gc-mobile-panel-content-pad)]">
              <section className="gc-clinical-card rounded-2xl border border-[color:var(--gc-border)] p-3 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-foreground">Notas da rodada</h3>
                  <span className="text-nano text-muted-foreground">
                    {notesDirty ? "Alterações pendentes" : "Sincronizado"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
                      Objetivo
                    </label>
                    <Input
                      value={notesDraft.objective}
                      onChange={(event) =>
                        updateNotesField("objective", event.target.value)
                      }
                      placeholder="Objetivo curto da conversa"
                      className="h-8 rounded-md border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
                      Notas
                    </label>
                    <Textarea
                      value={notesDraft.body}
                      onChange={(event) =>
                        updateNotesField("body", event.target.value)
                      }
                      placeholder="Resumo, decisões e contexto da rodada."
                      className="min-h-24 rounded-md border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-nano uppercase tracking-label text-muted-foreground">
                      Próximos passos (um por linha)
                    </label>
                    <Textarea
                      value={notesDraft.nextStepsText}
                      onChange={(event) =>
                        updateNotesField("nextStepsText", event.target.value)
                      }
                      placeholder={"Ex:\nRodar build final\nPublicar no serviço"}
                      className="min-h-20 rounded-md border-[color:var(--gc-border-soft)] bg-[var(--gc-surface-panel)] text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-nano text-muted-foreground">
                    Persistência server-side por conversa.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes || !notesDirty}
                    className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    {isSavingNotes ? (
                      <>
                        <LoaderCircle className="mr-1 size-3.5 animate-spin" />
                        Salvando
                      </>
                    ) : (
                      <>
                        <Save className="mr-1 size-3.5" />
                        Salvar notas
                      </>
                    )}
                  </Button>
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-[var(--gc-mobile-panel-content-pad)]">
              <WorkspaceCapturesPanelV2
                context="notes"
                conversationId={activeConversationId}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <AgendaPanelV2 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
