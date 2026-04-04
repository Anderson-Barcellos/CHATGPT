"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { buildInputFromMessages } from "@/lib/openai/buildInput";
import {
  listConversations,
  getConversation,
  saveConversationMessages,
  updateConversationTitle,
  createConversation,
} from "@/lib/storage/conversations";
import {
  Message,
  ReasoningSummary,
  SendMessageOptions,
  UrlCitation,
} from "@/types";
import { useCustomInstructions } from "@/hooks/useCustomInstructions";
import { useMemories } from "@/hooks/useMemories";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";
import { apiUrl } from "@/lib/utils";
import {
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { conversationKeys } from "@/hooks/queries/useConversationQuery";
import { toast } from "sonner";
import { createMessageArtifact } from "@/lib/artifacts/messageArtifacts";

function buildReasoningConfig(
  model: string,
  effort: string,
  summary: ReasoningSummary
) {
  if (!isReasoningModel(model)) return undefined;

  const reasoning: Record<string, string> = {};

  if (effort && effort !== "none") {
    reasoning.effort = effort;
  }

  if (summary && summary !== "off") {
    reasoning.summary = summary;
  }

  return Object.keys(reasoning).length ? reasoning : undefined;
}

function isClinicalReportRequest(content: string): boolean {
  const normalized = content.toLowerCase();
  const clinicalKeywords = [
    "ultrasson",
    "ultrason",
    "ecodoppler",
    "doppler",
    "laudo",
    "relatorio",
    "relatório",
    "impressao diagnostica",
    "impressão diagnóstica",
    "achados",
    "achados sonograficos",
    "achados sonográficos",
    "descricao tecnica",
    "descrição técnica",
    "exame",
    "punho",
    "ombro",
    "joelho",
    "membro inferior",
    "membro superior",
    "venoso",
    "arterial",
  ];

  return clinicalKeywords.some((keyword) => normalized.includes(keyword));
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

  const clinicalReportInstructions = `## Clinical Report Style
- When the request is for a medical imaging report, ultrasound report, Doppler report, or technical clinical write-up, prefer the style of a polished diagnostic report rather than an essay.
- Use a professional medical tone, objective phrasing, and concise technical language.
- Favor a clear exam title followed by sections such as "Descrição Técnica", "Achados", "Achados Sonográficos", "Conclusão" or "Impressão Diagnóstica" when appropriate to the case.
- Keep paragraphs and itemization clinically organized, with emphasis on findings, technique, and diagnostic impression.
- Avoid decorative prose, motivational phrasing, or generic explanatory filler.
- If the user is rewriting or adapting an existing report, preserve the original medical structure and terminology as much as possible while improving readability and consistency.`;

  return `${systemMessage}\n\n---\n\n${documentInstructions}${
    isClinicalReportRequest(content) ? `\n\n${clinicalReportInstructions}` : ""
  }`;
}

export function useChat() {
  const queryClient = useQueryClient();
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
  const { contextAboutUser, responsePreferences } = useCustomInstructions();
  const { memories } = useMemories();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    listConversations()
      .then(async (convs) => {
        if (convs.length > 0) {
          setActiveConversationId(convs[0].id);
        } else {
          const newId = await createConversation("Nova conversa");
          setActiveConversationId(newId);
          queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
        }
      })
      .catch((err) => {
        console.error("[useChat] Erro ao inicializar conversa:", err);
        setError("Erro ao inicializar. Por favor, recarregue a página.");
      });
  }, [queryClient, setActiveConversationId, setMessages]);

  useEffect(() => {
    if (!activeConversationId) return;
    setMessages([]);
    getConversation(activeConversationId)
      .then((conversation) => {
        if (conversation?.messages?.length) {
          setMessages(conversation.messages);
        }
      })
      .catch((err) => {
        console.error("[useChat] Erro ao carregar conversa:", err);
      });
  }, [activeConversationId, setMessages]);

  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}) => {
      const hasAttachments = (options.attachments?.length ?? 0) > 0;
      if (!content.trim() && !hasAttachments) return false;
      if (isLoading) return false;

      if (!activeConversationId) {
        console.warn("[useChat] activeConversationId não está pronto ainda");
        return false;
      }

      setIsLoading(true);
      setIsStreaming(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        attachments: options.attachments,
      };

      addMessage(userMessage);

      const assistantMessageId = crypto.randomUUID();
      const usesReasoning = isReasoningModel(parameters.model);
      addMessage({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        ...(options.documentMode && { preferredDisplayMode: "document" as const }),
        ...(usesReasoning && { reasoningStatus: "thinking" as const }),
      });

      try {
        const input = buildInputFromMessages(useChatStore.getState().messages);
        const reasoning = buildReasoningConfig(
          parameters.model,
          parameters.reasoningEffort,
          parameters.reasoningSummary
        );
        const { systemMessage: baseSystemMessage } = buildSystemPrompt(
          parameters.systemPrompt,
          { id: "default", contextAboutUser, responsePreferences },
          memories
        );
        const systemMessage = options.documentMode
          ? appendDocumentModeInstructions(baseSystemMessage, content)
          : baseSystemMessage;

        const response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input,
            model: parameters.model,
            instructions: systemMessage,
            maxOutputTokens: parameters.maxOutputTokens,
            ...(modelSupportsTemperature(parameters.model) && {
              temperature: parameters.temperature,
              topP: parameters.topP,
            }),
            ...(modelSupportsVerbosity(parameters.model) && {
              verbosity: parameters.verbosity,
            }),
            ...(modelSupportsCodeInterpreter(parameters.model) && {
              codeInterpreterEnabled: parameters.codeInterpreterEnabled,
            }),
            stream: true,
            reasoning,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao chamar a API");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Stream indisponível");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let reasoningSummary = "";
        let reasoningText = "";
        const citations: UrlCitation[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex).trim();
            buffer = buffer.slice(boundaryIndex + 2);

            if (rawEvent.length > 0) {
              const dataLine = rawEvent
                .split("\n")
                .find((line) => line.startsWith("data: "));

              if (dataLine) {
                const payload = dataLine.replace("data: ", "").trim();

                if (payload === "[DONE]") {
                  boundaryIndex = buffer.indexOf("\n\n");
                  continue;
                }

                try {
                  const event = JSON.parse(payload);

                  if (event.type === "response.output_text.delta") {
                    accumulated += event.delta || "";
                    updateMessage(assistantMessageId, { content: accumulated });
                  }

                  if (
                    event.type === "response.output_item.added" &&
                    event.item?.type === "image_generation_call"
                  ) {
                    updateMessage(assistantMessageId, { isGeneratingImage: true });
                  }

                  if (event.type === "response.image_generation_call.partial_image") {
                    updateMessage(assistantMessageId, {
                      imageBase64: event.partial_image_b64,
                      imageMimeType: "image/png",
                      isGeneratingImage: true,
                    });
                  }

                  if (
                    event.type === "response.output_item.done" &&
                    event.item?.type === "image_generation_call" &&
                    event.item?.result
                  ) {
                    updateMessage(assistantMessageId, {
                      imageBase64: event.item.result,
                      imageMimeType: "image/png",
                    });
                  }

                  if (
                    event.type === "response.output_item.added" &&
                    event.item?.type === "web_search_call"
                  ) {
                    updateMessage(assistantMessageId, { isSearching: true });
                  }

                  if (
                    event.type === "response.output_item.done" &&
                    event.item?.type === "web_search_call"
                  ) {
                    updateMessage(assistantMessageId, { isSearching: false });
                  }

                  if (event.type === "response.output_text.annotation.added") {
                    const ann = event.annotation;
                    if (ann?.type === "url_citation" && ann.url) {
                      const exists = citations.some((c) => c.url === ann.url);
                      if (!exists) {
                        citations.push({ title: ann.title || "", url: ann.url });
                        updateMessage(assistantMessageId, { citations: [...citations] });
                      }
                    }
                  }

                  if (event.type === "response.reasoning_summary_text.delta") {
                    reasoningSummary += event.delta || "";
                    updateMessage(assistantMessageId, {
                      reasoningSummary,
                      reasoningStatus: "thinking",
                    });
                  }

                  if (event.type === "response.reasoning_text.delta") {
                    reasoningText += event.delta || "";
                    updateMessage(assistantMessageId, {
                      reasoningText,
                      reasoningStatus: "thinking",
                    });
                  }
                } catch {
                  // Ignora chunks parciais
                }
              }
            }

            boundaryIndex = buffer.indexOf("\n\n");
          }
        }

        if (usesReasoning) {
          updateMessage(assistantMessageId, {
            reasoningStatus: "complete",
          });
        }

        if (accumulated.trim().length > 0) {
          const artifact = options.documentMode
            ? createMessageArtifact(accumulated, {
                force: true,
                displayMode: "document",
              })
            : undefined;
          if (artifact) {
            updateMessage(assistantMessageId, { artifact });
          }
        }

        try {
          const finalMessages = useChatStore.getState().messages;
          const messagesForStorage = finalMessages.map((m) => {
            if (!m.attachments?.length) return m;
            return {
              ...m,
              attachments: m.attachments.map((a) => ({
                ...a,
                dataUrl: a.type === "image" ? a.thumbnailUrl : undefined,
                extractedText: a.extractedText ? `[${a.extractedText.length} chars]` : undefined,
              })),
            };
          });
          await saveConversationMessages(activeConversationId, messagesForStorage);

          const userMsgs = finalMessages.filter((m) => m.role === "user");
          if (userMsgs.length === 1) {
            const snippet = userMsgs[0].content.slice(0, 60).trim();
            const title = snippet + (userMsgs[0].content.length > 60 ? "..." : "");
            await updateConversationTitle(activeConversationId, title);
          }

          queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
          queryClient.invalidateQueries({
            queryKey: conversationKeys.detail(activeConversationId),
          });
        } catch (saveErr) {
          console.error("[useChat] Falha ao salvar conversa:", saveErr);
          toast.error("Mensagem enviada, mas não foi salva. Tente recarregar.");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          updateMessage(assistantMessageId, {
            content: "⏹️ Geração cancelada.",
            ...(usesReasoning && { reasoningStatus: "complete" as const }),
          });
        } else {
          const message =
            err instanceof Error ? err.message : "Erro desconhecido";
          setError(message);
          updateMessage(assistantMessageId, {
            content: `❌ ${message}`,
            ...(usesReasoning && { reasoningStatus: "complete" as const }),
          });
        }
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }

      return true;
    },
    [
      activeConversationId,
      addMessage,
      contextAboutUser,
      isLoading,
      memories,
      parameters.maxOutputTokens,
      parameters.model,
      parameters.codeInterpreterEnabled,
      parameters.reasoningEffort,
      parameters.reasoningSummary,
      parameters.systemPrompt,
      parameters.temperature,
      parameters.topP,
      parameters.verbosity,
      queryClient,
      responsePreferences,
      setIsStreaming,
      updateMessage,
    ]
  );

  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim() || isLoading) return;
      truncateFromMessage(messageId);
      await new Promise((r) => setTimeout(r, 0));
      await sendMessage(newContent);
    },
    [isLoading, truncateFromMessage, sendMessage]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      deleteMessagePair(messageId);
      if (activeConversationId) {
        const finalMessages = useChatStore.getState().messages;
        await saveConversationMessages(activeConversationId, finalMessages);
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      }
    },
    [activeConversationId, deleteMessagePair, queryClient]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [setIsStreaming]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    editAndResend,
    deleteMessage,
    stopGeneration,
  };
}
