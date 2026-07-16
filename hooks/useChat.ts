"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUIStore } from "@/stores/uiStore";
import { parseApiErrorResponse } from "@/lib/api/errors";
import {
  assistantStreamStateToMessagePatch,
  createInitialAssistantStreamState,
  extractSsePayloads,
  finalizeAssistantStreamState,
  reduceAssistantStreamEvent,
} from "@/lib/chat/streamMachine";
import { createStreamPatchScheduler } from "@/lib/chat/streamPatchScheduler";
import { buildInputFromMessages } from "@/lib/openai/buildInput";
import {
  listConversations,
  getConversation,
  saveConversationMessages,
  saveConversationMessagesAndTitle,
  saveConversationMessagesViaBeacon,
  createConversation,
} from "@/lib/storage/conversations";
import { withConversationPersistenceRetry } from "@/lib/storage/conversationPersistence";
import {
  Message,
  ReasoningEffort,
  ResponseMode,
  SendMessageOptions,
} from "@/types";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import { useMemories } from "@/hooks/useMemories";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";
import { searchMemoryContext } from "@/lib/storage/memoryRag";
import { refreshConversationMemoryLayer } from "@/lib/chat/memoryRefresh";
import { apiUrl } from "@/lib/utils";
import { buildEditResendOptions } from "@/lib/chat/resendOptions";
import { buildQuizCompletionPatch } from "@/lib/chat/quizCompletion";
import { buildAbortedAssistantMessagePatch } from "@/lib/chat/abortCompletion";
import { buildReasoningConfig } from "@/lib/chat/reasoningConfig";
import { createThrottle } from "@/lib/performance/throttle";
import {
  isDeepSeekModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { toast } from "sonner";
import { createMessageArtifact } from "@/lib/artifacts/messageArtifacts";
import { deserializeMessage } from "@/lib/storage/serializers";
import {
  QUIZ_FORCED_MODEL,
  QUIZ_FORCED_REASONING_EFFORT,
  QUIZ_MIN_QUESTION_COUNT,
} from "@/lib/artifacts/quizArtifacts";

const STREAM_AUTO_SAVE_INTERVAL_MS = 2000;
const BACKGROUND_POLL_INTERVAL_MS = 5000;
const DOCUMENT_FORCED_MODEL = "gpt-5.4-mini";
const DEEPSEARCH_MEDIUM_MODEL = "gpt-5.4-mini";
const DEEPSEARCH_HIGH_MODEL = "gpt-5.4";

function isPendingBackgroundMessage(message: Message): boolean {
  return (
    message.role === "assistant" &&
    !!message.backgroundJob?.responseId &&
    (message.backgroundJob.status === "queued" ||
      message.backgroundJob.status === "in_progress")
  );
}

function normalizeStreamingMessages(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.role !== "assistant" || message.streamStatus !== "streaming") {
      return message;
    }

    if (isPendingBackgroundMessage(message)) {
      return message;
    }

    const reasoningCleanup =
      message.reasoningStatus === "thinking"
        ? { reasoningStatus: "complete" as const }
        : {};

    return {
      ...message,
      streamStatus: "interrupted" as const,
      isGeneratingImage: false,
      isSearching: false,
      ...reasoningCleanup,
    };
  });
}

function isClinicalReportRequest(content: string): boolean {
  const normalized = content.toLowerCase();

  // Keywords inequivocamente clínicas — qualquer uma basta
  const specificKeywords = [
    "ultrasson", "ultrason", "ecodoppler", "doppler",
    "laudo",
    "impressão diagnóstica", "impressao diagnostica",
    "achados sonográficos", "achados sonograficos",
    "descrição técnica", "descricao tecnica",
  ];
  if (specificKeywords.some((kw) => normalized.includes(kw))) return true;

  // Keywords genéricas — exigem co-ocorrência de pelo menos 2 para evitar falsos positivos
  // ("exame de matemática" ou "joelho dói" não disparam, "achados no joelho" sim)
  const genericKeywords = [
    "exame", "achados", "relatorio", "relatório",
    "venoso", "arterial",
    "punho", "ombro", "joelho", "membro inferior", "membro superior",
  ];
  const genericMatches = genericKeywords.filter((kw) => normalized.includes(kw));
  return genericMatches.length >= 2;
}

function appendDocumentModeInstructions(
  systemMessage: string,
  content: string
): string {
  const documentInstructions = `## Document Mode
- The user explicitly wants a polished document, not a conversational answer.
- Return a complete, publication-ready markdown document.
- Start with a clear title, then use structured sections with descriptive headings.
- Prefer flowing paragraphs with strong readability.
- Use lists, tables, callouts, or code blocks only when they improve clarity.
- Keep formatting elegant and consistent, as if preparing a professional PDF-ready document.
- Do not add a chatty intro, outro, or follow-up question.
- Deliver the final document directly.`;

  const deepResearchFoundationInstructions = `## Deep Research Foundation
- Treat document mode as a research-grade writing flow, not a quick chat reply.
- Build the document from a clear chain: scope -> assumptions -> method -> findings -> synthesis -> conclusion.
- Go beyond summary: compare viewpoints, expose tradeoffs, and flag relevant uncertainty.
- Use evidence-oriented language and clearly separate facts, inferences, and recommendations.
- Never invent external citations, studies, or statistics. If no source exists in the provided context, state this limitation transparently.
- Keep depth proportional to the request: concise when asked for brevity, comprehensive for broad or complex tasks.`;

  const styleAnchorInstructions = `## Style Anchor (Must Preserve)
- The writing style defined by the base system prompt and custom instructions remains the source of truth.
- Apply deep-research rigor without overriding the existing voice, tone, and stylistic constraints.
- If there is tension between structure and style, preserve style while improving analytical depth and clarity.`;

  const clinicalReportInstructions = `## Clinical Report Style
- When the request is for a medical imaging report, ultrasound report, Doppler report, or technical clinical write-up, prefer the style of a polished diagnostic report rather than an essay.
- Use a professional medical tone, objective phrasing, and concise technical language.
- Favor a clear exam title followed by sections such as "Descrição Técnica", "Achados", "Achados Sonográficos", "Conclusão" or "Impressão Diagnóstica" when appropriate to the case.
- Keep paragraphs and itemization clinically organized, with emphasis on findings, technique, and diagnostic impression.
- When words such as "imagem", "ultrassonografia", "ecodoppler", "onda" or "traçado" refer to clinical source material, describe or interpret the finding in text; do not attempt to create a new image.
- For Doppler waveforms or simple visual patterns, ASCII sketches inside fenced code blocks are allowed when they clarify morphology, direction, phasicity or timing.
- Avoid decorative prose, motivational phrasing, or generic explanatory filler.
- If the user is rewriting or adapting an existing report, preserve the original medical structure and terminology as much as possible while improving readability and consistency.`;

  return `${systemMessage}\n\n---\n\n${documentInstructions}\n\n${deepResearchFoundationInstructions}\n\n${styleAnchorInstructions}${
    isClinicalReportRequest(content) ? `\n\n${clinicalReportInstructions}` : ""
  }`;
}

function isDocumentLikeMode(responseMode: ResponseMode): boolean {
  return (
    responseMode === "document" ||
    responseMode === "deepsearch_medium" ||
    responseMode === "deepsearch_high"
  );
}

function resolveDeepsearchReasoningEffort(responseMode: ResponseMode): ReasoningEffort {
  if (responseMode === "deepsearch_high") return "high";
  return "medium";
}

function resolveDeepsearchModel(responseMode: ResponseMode): string {
  if (responseMode === "deepsearch_high") return DEEPSEARCH_HIGH_MODEL;
  return DEEPSEARCH_MEDIUM_MODEL;
}

function appendQuizModeInstructions(systemMessage: string): string {
  const quizInstructions = `## Quiz Mode
- The user wants a multiple-choice quiz rendered in an interactive canvas.
- Always use Brazilian Portuguese unless the user explicitly asks for another language.
- Generate at least ${QUIZ_MIN_QUESTION_COUNT} multiple-choice questions unless the user explicitly asks for more.
- If the user asks for fewer than ${QUIZ_MIN_QUESTION_COUNT} questions, still return ${QUIZ_MIN_QUESTION_COUNT}.
- Default to 4 options per question when the user does not specify quantity.
- Each question must have exactly one correct answer.
- Explanations should be brief, accurate, and useful after grading.
- Return only the structured JSON requested by the response schema.
- Do not include markdown, prose outside the schema, or conversational wrappers.`;

  return `${systemMessage}\n\n---\n\n${quizInstructions}`;
}

function getPreferredDisplayMode(responseMode: ResponseMode) {
  if (isDocumentLikeMode(responseMode)) return "document" as const;
  if (responseMode === "quiz") return "quiz" as const;
  return undefined;
}

function cloneMessagesForStorage(messages: Message[]): Message[] {
  return messages.map((message) => ({
    ...message,
    attachments: message.attachments?.map((attachment) => ({
      ...attachment,
    })),
  }));
}

async function persistConversationSnapshot(
  conversationId: string,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const finalMessages = useChatStore.getState().messages;
  const messagesForStorage = cloneMessagesForStorage(finalMessages);
  const userMessages = finalMessages.filter((message) => message.role === "user");

  if (userMessages.length === 1) {
    const snippet = userMessages[0].content.slice(0, 60).trim();
    const title = snippet + (userMessages[0].content.length > 60 ? "..." : "");
    await withConversationPersistenceRetry(() =>
      saveConversationMessagesAndTitle(conversationId, messagesForStorage, title)
    );
  } else {
    await withConversationPersistenceRetry(() =>
      saveConversationMessages(conversationId, messagesForStorage)
    );
  }

  await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
  await queryClient.invalidateQueries({
    queryKey: conversationKeys.detail(conversationId),
  });
}

async function refreshMemoryLayerForConversation(
  conversationId: string,
  status: "completed" | "aborted" | "interrupted" | "failed"
) {
  try {
    await refreshConversationMemoryLayer(conversationId, status);
  } catch (error) {
    console.warn("[useChat] Falha ao atualizar camada de memoria:", error);
  }
}

async function persistConversationSnapshotSafely(
  conversationId: string,
  queryClient: ReturnType<typeof useQueryClient>,
  errorMessage: string
) {
  try {
    await persistConversationSnapshot(conversationId, queryClient);
  } catch (saveErr) {
    console.error("[useChat] Falha ao salvar conversa:", saveErr);
    toast.error(errorMessage);
  }
}

export function useChat() {
  const queryClient = useQueryClient();
  const { imageQuality, imageSize } = useUIStore();
  const {
    messages,
    setMessages,
    setIsStreaming,
    addMessage,
    updateMessage,
    truncateFromMessage,
    deleteMessagePair,
    activeConversationId,
    setActiveConversationId,
  } = useChatStore();
  const { parameters } = useSettingsStore();
  const { contextAboutUser, responsePreferences, customSystemInstructions } = useCustomInstructions();
  const { memories } = useMemories();
  const [isLoading, setIsLoading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(true);
  const [conversationLoadNonce, setConversationLoadNonce] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeBackgroundMessageRef = useRef<{
    conversationId: string;
    assistantMessageId: string;
    responseId: string;
  } | null>(null);
  const backgroundSyncInFlightRef = useRef<Set<string>>(new Set());
  const backgroundReconcileInFlightRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasBeaconFiredRef = useRef(false);

  const reloadConversations = useCallback(async () => {
    setIsRecovering(true);
    setRecoveryError(null);

    try {
      const conversations = await listConversations();
      const activeId = useChatStore.getState().activeConversationId;
      const preferredConversation =
        activeId && conversations.some((conversation) => conversation.id === activeId)
          ? activeId
          : conversations[0]?.id;

      if (preferredConversation) {
        setActiveConversationId(preferredConversation);
        setConversationLoadNonce((current) => current + 1);
      } else {
        const newId = await createConversation("Nova conversa");
        setActiveConversationId(newId);
        setConversationLoadNonce((current) => current + 1);
        await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      }
    } catch (error) {
      console.error("[useChat] Erro ao inicializar conversa:", error);
      setActiveConversationId(null);
      setMessages([]);
      setRecoveryError(
        "Nao consegui inicializar as conversas. Recarrega a pagina para tentar de novo."
      );
      setIsRecovering(false);
    }
  }, [queryClient, setActiveConversationId, setMessages]);

  const applyServerMessagePatch = useCallback(
    (message: Message) => {
      const normalized = deserializeMessage(message);
      updateMessage(normalized.id, {
        content: normalized.content,
        streamStatus: normalized.streamStatus,
        responseMode: normalized.responseMode,
        preferredDisplayMode: normalized.preferredDisplayMode,
        reasoningSummary: normalized.reasoningSummary,
        reasoningText: normalized.reasoningText,
        reasoningStatus: normalized.reasoningStatus,
        imageBase64: normalized.imageBase64,
        imageMimeType: normalized.imageMimeType,
        isGeneratingImage: normalized.isGeneratingImage,
        isSearching: normalized.isSearching,
        citations: normalized.citations,
        artifact: normalized.artifact,
        inputTokens: normalized.inputTokens,
        outputTokens: normalized.outputTokens,
        cachedTokens: normalized.cachedTokens,
        reasoningTokens: normalized.reasoningTokens,
        backgroundJob: normalized.backgroundJob,
      });
    },
    [updateMessage]
  );

  const reconcileBackgroundJobs = useCallback(async () => {
    if (backgroundReconcileInFlightRef.current) return;
    backgroundReconcileInFlightRef.current = true;

    try {
      const response = await fetch(apiUrl("/api/chat/background/reconcile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 8 }),
      });
      if (!response.ok) throw await parseApiErrorResponse(response);

      const payload = (await response.json()) as {
        results?: Array<{
          conversationId?: string;
          message?: Message;
        }>;
      };
      const touchedConversationIds = new Set<string>();

      for (const result of payload.results ?? []) {
        if (result.conversationId) {
          touchedConversationIds.add(result.conversationId);
        }
        if (result.message) {
          applyServerMessagePatch(result.message);
        }
      }

      if (touchedConversationIds.size > 0) {
        await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
        for (const conversationId of touchedConversationIds) {
          await queryClient.invalidateQueries({
            queryKey: conversationKeys.detail(conversationId),
          });
        }
      }

      if ((payload.results?.length ?? 0) > 0 || activeBackgroundMessageRef.current) {
        const hasPendingBackground = useChatStore
          .getState()
          .messages.some(isPendingBackgroundMessage);
        setIsLoading(hasPendingBackground);
        setIsStreaming(hasPendingBackground);
        if (!hasPendingBackground) {
          activeBackgroundMessageRef.current = null;
        }
      }
    } catch (err) {
      console.warn("[useChat] Falha ao reconciliar background jobs:", err);
    } finally {
      backgroundReconcileInFlightRef.current = false;
    }
  }, [applyServerMessagePatch, queryClient, setIsStreaming]);

  const syncBackgroundMessage = useCallback(
    async (message: Message) => {
      if (!activeConversationId || !message.backgroundJob?.responseId) return;

      const key = `${activeConversationId}:${message.id}`;
      if (backgroundSyncInFlightRef.current.has(key)) return;
      backgroundSyncInFlightRef.current.add(key);

      try {
        const response = await fetch(apiUrl("/api/chat/background/sync"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversationId,
            assistantMessageId: message.id,
            responseId: message.backgroundJob.responseId,
          }),
        });
        if (!response.ok) throw await parseApiErrorResponse(response);

        const payload = (await response.json()) as { message?: Message };
        if (payload.message) {
          applyServerMessagePatch(payload.message);
          const synced = deserializeMessage(payload.message);
          if (!isPendingBackgroundMessage(synced)) {
            activeBackgroundMessageRef.current = null;
            setIsLoading(false);
            setIsStreaming(false);
            await queryClient.invalidateQueries({
              queryKey: conversationKeys.lists(),
            });
            await queryClient.invalidateQueries({
              queryKey: conversationKeys.detail(activeConversationId),
            });
          }
        }
      } catch (err) {
        console.warn("[useChat] Falha ao sincronizar background job:", err);
      } finally {
        backgroundSyncInFlightRef.current.delete(key);
      }
    },
    [
      activeConversationId,
      applyServerMessagePatch,
      queryClient,
      setIsStreaming,
    ]
  );

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void reloadConversations();
    void reconcileBackgroundJobs();
  }, [reconcileBackgroundJobs, reloadConversations]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void reconcileBackgroundJobs();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reconcileBackgroundJobs]);

  useEffect(() => {
    if (!activeConversationId) return;

    let isCurrent = true;
    setIsRecovering(true);
    setRecoveryError(null);
    setMessages([]);

    getConversation(activeConversationId)
      .then((conversation) => {
        if (!isCurrent) return;

        if (conversation?.messages?.length) {
          const normalized = normalizeStreamingMessages(conversation.messages);
          setMessages(normalized);

          const wasInterrupted = normalized.some(
            (message, idx) => message !== conversation.messages[idx]
          );
          if (wasInterrupted) {
            void withConversationPersistenceRetry(() =>
              saveConversationMessages(
                activeConversationId,
                cloneMessagesForStorage(normalized)
              )
            )
              .then(() =>
                refreshMemoryLayerForConversation(
                  activeConversationId,
                  "interrupted"
                )
              )
              .catch((err) => {
                console.warn(
                  "[useChat] Falha ao persistir normalização de interrupted:",
                  err
                );
              });
          }
          if (normalized.some(isPendingBackgroundMessage)) {
            void reconcileBackgroundJobs();
          }
        }
        setIsRecovering(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error("[useChat] Erro ao carregar conversa:", err);
        setMessages([]);
        setRecoveryError("Nao consegui carregar esta conversa agora.");
        setIsRecovering(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeConversationId, conversationLoadNonce, reconcileBackgroundJobs, setMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePageHide = () => {
      // pagehide é o evento recomendado para beacon — beforeunload foi removido pois
      // ambos disparavam em sequência causando race condition no lock do arquivo JSON
      if (hasBeaconFiredRef.current) return;
      hasBeaconFiredRef.current = true;

      const state = useChatStore.getState();
      if (!state.isStreaming || !state.activeConversationId) return;

      const hasPendingBackground = state.messages.some(isPendingBackgroundMessage);
      if (!hasPendingBackground) {
        abortControllerRef.current?.abort();
      }

      const normalized = hasPendingBackground
        ? state.messages
        : normalizeStreamingMessages(state.messages);
      saveConversationMessagesViaBeacon(
        state.activeConversationId,
        cloneMessagesForStorage(normalized)
      );
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      hasBeaconFiredRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;

    const pending = messages.filter(isPendingBackgroundMessage);
    if (pending.length === 0) return;

    activeBackgroundMessageRef.current = {
      conversationId: activeConversationId,
      assistantMessageId: pending[0].id,
      responseId: pending[0].backgroundJob!.responseId!,
    };
    setIsLoading(true);
    setIsStreaming(true);

    const syncAll = () => {
      for (const message of pending) {
        void syncBackgroundMessage(message);
      }
    };

    syncAll();
    const interval = window.setInterval(syncAll, BACKGROUND_POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeConversationId, messages, setIsStreaming, syncBackgroundMessage]);

  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}) => {
      const responseMode = options.responseMode ?? "default";
      const hasAttachments = (options.attachments?.length ?? 0) > 0;
      if (!content.trim() && !hasAttachments) return false;
      if (isLoading) return false;

      if (!activeConversationId) {
        setComposerError("Ainda nao existe uma conversa pronta para enviar a mensagem.");
        return false;
      }

      setIsLoading(true);
      setIsStreaming(true);
      setComposerError(null);
      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        responseMode,
        attachments: options.attachments,
      };

      addMessage(userMessage);

      const input = buildInputFromMessages(useChatStore.getState().messages);

      const assistantMessageId = crypto.randomUUID();
      const requestModel = responseMode === "quiz"
        ? QUIZ_FORCED_MODEL
        : responseMode === "document" && isDeepSeekModel(parameters.model)
        ? DOCUMENT_FORCED_MODEL
        : responseMode === "deepsearch_medium" || responseMode === "deepsearch_high"
        ? resolveDeepsearchModel(responseMode)
        : parameters.model;
      const requestReasoningEffort =
        responseMode === "quiz"
          ? QUIZ_FORCED_REASONING_EFFORT
          : responseMode === "deepsearch_medium" || responseMode === "deepsearch_high"
          ? resolveDeepsearchReasoningEffort(responseMode)
          : parameters.reasoningEffort;
      const requestVerbosity =
        responseMode === "deepsearch_medium" || responseMode === "deepsearch_high"
          ? "high"
          : parameters.verbosity;
      const reasoning = buildReasoningConfig(
        requestModel,
        requestReasoningEffort,
        parameters.reasoningSummary,
        parameters.reasoningMode
      );
      const usesReasoning = !!reasoning && responseMode !== "quiz";
      const preferredDisplayMode = getPreferredDisplayMode(responseMode);
      addMessage({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        streamStatus: "streaming",
        responseMode,
        ...(preferredDisplayMode && { preferredDisplayMode }),
        ...(usesReasoning && { reasoningStatus: "thinking" as const }),
      });

      let streamState = createInitialAssistantStreamState(usesReasoning);
      const streamPatchScheduler = createStreamPatchScheduler({
        updateMessage,
      });

      const throttledAutoSave = createThrottle(() => {
        const snapshot = cloneMessagesForStorage(
          useChatStore.getState().messages
        );
        void saveConversationMessages(activeConversationId, snapshot).catch(
          (err) => {
            console.warn("[useChat] Falha em auto-save throttled:", err);
          }
        );
      }, STREAM_AUTO_SAVE_INTERVAL_MS);

      let sent = false;

      try {
        try {
          await withConversationPersistenceRetry(() =>
            saveConversationMessages(
              activeConversationId,
              cloneMessagesForStorage(useChatStore.getState().messages)
            )
          );
        } catch (err) {
          console.warn(
            "[useChat] Falha em flush imediato pré-stream (segue mesmo assim):",
            err
          );
        }
        const retrievedContext = await searchMemoryContext({
          query: content,
          excludeConversationId: activeConversationId,
          topK: 4,
        }).catch((error) => {
          console.warn("[useChat] Falha ao recuperar contexto de memoria:", error);
          return [];
        });

        const { systemMessage: baseSystemMessage } = buildSystemPrompt(
          parameters.systemPrompt,
          { id: "default", contextAboutUser, responsePreferences, customSystemInstructions },
          memories,
          retrievedContext,
          responseMode === "default"
        );
        const systemMessage =
          isDocumentLikeMode(responseMode)
            ? appendDocumentModeInstructions(baseSystemMessage, content)
            : responseMode === "quiz"
            ? appendQuizModeInstructions(baseSystemMessage)
            : baseSystemMessage;

        const requestPayload = {
          input,
          model: requestModel,
          instructions: systemMessage,
          maxOutputTokens: parameters.maxOutputTokens,
          ...(modelSupportsTemperature(requestModel) && {
            temperature: parameters.temperature,
            topP: parameters.topP,
          }),
          ...(modelSupportsVerbosity(requestModel) && {
            verbosity: requestVerbosity,
          }),
          ...(modelSupportsCodeInterpreter(requestModel) && {
            codeInterpreterEnabled: parameters.codeInterpreterEnabled,
          }),
          imageQuality,
          imageSize,
          stream: responseMode !== "quiz",
          reasoning,
          responseMode,
        };

        if (isDocumentLikeMode(responseMode)) {
          updateMessage(assistantMessageId, {
            content: "Processando no servidor. Pode trocar de aba que eu sincronizo quando voltares.",
            isSearching: true,
            backgroundJob: {
              status: "queued",
              startedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });

          await withConversationPersistenceRetry(() =>
            saveConversationMessages(
              activeConversationId,
              cloneMessagesForStorage(useChatStore.getState().messages)
            )
          );

          const response = await fetch(apiUrl("/api/chat/background"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...requestPayload,
              conversationId: activeConversationId,
              assistantMessageId,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            throw await parseApiErrorResponse(response);
          }

          const payload = (await response.json()) as {
            responseId?: string;
            message?: Message;
          };
          if (payload.message) {
            applyServerMessagePatch(payload.message);
          }

          const serverMessage = payload.message
            ? deserializeMessage(payload.message)
            : undefined;
          const responseId =
            serverMessage?.backgroundJob?.responseId ?? payload.responseId;

          if (responseId) {
            activeBackgroundMessageRef.current = {
              conversationId: activeConversationId,
              assistantMessageId,
              responseId,
            };
          }

          sent = true;
          return sent;
        }

        const response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw await parseApiErrorResponse(response);
        }

        let accumulated = "";

        if (responseMode === "quiz") {
          const payload = (await response.json()) as { output_text?: string };
          accumulated = payload.output_text?.trim() || "";
        } else {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Stream indisponível");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const extraction = extractSsePayloads(buffer);
            buffer = extraction.buffer;

            for (const payload of extraction.payloads) {
              if (payload === "[DONE]") continue;

              try {
                const event = JSON.parse(payload);
                streamState = reduceAssistantStreamEvent(streamState, event);
                accumulated = streamState.content;
                streamPatchScheduler.schedule(
                  assistantMessageId,
                  assistantStreamStateToMessagePatch(streamState)
                );
                throttledAutoSave.call();
              } catch {
                // Ignora chunks parciais ou eventos irrelevantes
              }
            }
          }

          streamPatchScheduler.flush();
          streamState = finalizeAssistantStreamState(
            streamState,
            "completed",
            usesReasoning
          );
          accumulated = streamState.content;
          updateMessage(
            assistantMessageId,
            assistantStreamStateToMessagePatch(streamState)
          );
        }

        if (accumulated.trim().length > 0) {
          if (responseMode === "quiz") {
            const patch = buildQuizCompletionPatch(accumulated);
            if (!patch.artifact) {
              toast.error("Nao consegui montar o quiz interativo. Vou preservar a resposta bruta para tu revisar.");
            }
            updateMessage(assistantMessageId, patch);
          } else {
            const artifact =
              isDocumentLikeMode(responseMode)
                ? createMessageArtifact(accumulated, {
                    force: true,
                    displayMode: "document",
                    citations: streamState.citations,
                  })
                : undefined;
            if (artifact) {
              updateMessage(assistantMessageId, {
                content: artifact.summary,
                artifact,
              });
            }
          }
        } else if (responseMode === "quiz") {
          // Quiz retornou vazio — o path não-streaming nunca chamou finalizeAssistantStreamState,
          // então a mensagem ainda está em streamStatus:"streaming". Forçar falha explícita.
          updateMessage(assistantMessageId, {
            streamStatus: "failed",
            content: "⚠️ Não recebi resposta do servidor para gerar o quiz. Tente enviar de novo.",
          });
        }

        await persistConversationSnapshotSafely(
          activeConversationId,
          queryClient,
          "Mensagem enviada, mas não foi salva. Tente recarregar."
        );

        void refreshMemoryLayerForConversation(
          activeConversationId,
          "completed"
        );

        sent = true;
      } catch (err) {
        streamPatchScheduler.flush();
        if (err instanceof DOMException && err.name === "AbortError") {
          updateMessage(assistantMessageId, {
            ...buildAbortedAssistantMessagePatch(streamState, usesReasoning),
          });

          await persistConversationSnapshotSafely(
            activeConversationId,
            queryClient,
            "A geração foi interrompida, mas não consegui salvar esse estado."
          );

          void refreshMemoryLayerForConversation(
            activeConversationId,
            "aborted"
          );

          sent = true;
        } else {
          const message =
            err instanceof Error ? err.message : "Erro desconhecido";
          setComposerError(message);
          updateMessage(assistantMessageId, {
            ...assistantStreamStateToMessagePatch(
              finalizeAssistantStreamState(
                streamState,
                "failed",
                usesReasoning
              )
            ),
          });
          updateMessage(assistantMessageId, {
            content: `❌ ${message}`,
          });

          await persistConversationSnapshotSafely(
            activeConversationId,
            queryClient,
            "A mensagem falhou e eu também não consegui persistir esse estado."
          );

          void refreshMemoryLayerForConversation(
            activeConversationId,
            "failed"
          );

          sent = false;
        }
      } finally {
        streamPatchScheduler.cancel();
        throttledAutoSave.cancel();
        const hasPendingBackground = useChatStore
          .getState()
          .messages.some(isPendingBackgroundMessage);
        setIsLoading(hasPendingBackground);
        setIsStreaming(hasPendingBackground);
        abortControllerRef.current = null;
      }

      return sent;
    },
    [
      activeConversationId,
      addMessage,
      applyServerMessagePatch,
      contextAboutUser,
      customSystemInstructions,
      isLoading,
      memories,
      parameters.maxOutputTokens,
      parameters.model,
      parameters.codeInterpreterEnabled,
      parameters.reasoningEffort,
      parameters.reasoningMode,
      parameters.reasoningSummary,
      parameters.systemPrompt,
      parameters.temperature,
      parameters.topP,
      parameters.verbosity,
      queryClient,
      responsePreferences,
      setIsStreaming,
      updateMessage,
      imageQuality,
      imageSize,
    ]
  );

  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim() || isLoading) return;
      const originalMessage = useChatStore
        .getState()
        .messages.find((message) => message.id === messageId);
      truncateFromMessage(messageId);
      await new Promise((r) => setTimeout(r, 0));
      await sendMessage(newContent, buildEditResendOptions(originalMessage));
    },
    [isLoading, truncateFromMessage, sendMessage]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      deleteMessagePair(messageId);
      if (activeConversationId) {
        const finalMessages = cloneMessagesForStorage(useChatStore.getState().messages);
        try {
          await withConversationPersistenceRetry(() =>
            saveConversationMessages(activeConversationId, finalMessages)
          );
          await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
        } catch (error) {
          console.error("[useChat] Falha ao persistir exclusao:", error);
          toast.error("A resposta sumiu da tela, mas nao consegui salvar essa exclusao.");
        }
      }
    },
    [activeConversationId, deleteMessagePair, queryClient]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setIsStreaming(false);
      return;
    }

    const background = activeBackgroundMessageRef.current;
    if (!background) return;

    void fetch(apiUrl("/api/chat/background/cancel"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(background),
    })
      .then(async (response) => {
        if (!response.ok) throw await parseApiErrorResponse(response);
        return response.json() as Promise<{ message?: Message }>;
      })
      .then(async (payload) => {
        if (payload.message) {
          applyServerMessagePatch(payload.message);
        }
        activeBackgroundMessageRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
        if (activeConversationId) {
          await queryClient.invalidateQueries({
            queryKey: conversationKeys.lists(),
          });
          await queryClient.invalidateQueries({
            queryKey: conversationKeys.detail(activeConversationId),
          });
        }
      })
      .catch((err) => {
        console.warn("[useChat] Falha ao cancelar background job:", err);
        toast.error("Nao consegui cancelar a tarefa em segundo plano agora.");
      });
  }, [
    activeConversationId,
    applyServerMessagePatch,
    queryClient,
    setIsStreaming,
  ]);

  return {
    messages,
    isLoading,
    error: composerError,
    recoveryError,
    isRecovering,
    reloadConversations,
    sendMessage,
    editAndResend,
    deleteMessage,
    stopGeneration,
  };
}
