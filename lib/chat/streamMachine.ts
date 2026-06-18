import {
  Message,
  MessageStreamStatus,
  ReasoningStatus,
  UrlCitation,
} from "@/types";
import { cleanCitationMarkers } from "@/lib/artifacts/messageArtifacts";

export type AssistantStreamTerminalStatus = MessageStreamStatus;

export type AssistantStreamEvent =
  | { type: "response.output_text.delta"; delta?: string }
  | { type: "response.output_item.added"; item?: { type?: string } }
  | {
      type: "response.output_item.done";
      item?: { type?: string; result?: string };
    }
  | {
      type: "response.image_generation_call.partial_image";
      partial_image_b64?: string;
    }
  | {
      type: "response.output_text.annotation.added";
      annotation?: { type?: string; url?: string; title?: string };
    }
  | { type: "response.reasoning_text.delta"; delta?: string }
  | { type: "response.reasoning_summary_text.delta"; delta?: string }
  | {
      type: "response.completed";
      response?: {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          input_tokens_details?: { cached_tokens?: number };
          output_tokens_details?: { reasoning_tokens?: number };
        };
      };
    }
  | {
      type: "response.reasoning_summary_part.added";
      part?: { text?: string; type?: string };
      summary_index?: number;
    }
  | {
      type: "response.reasoning_summary_part.done";
      part?: { text?: string; type?: string };
      summary_index?: number;
    }
  | {
      type: "response.reasoning_summary_text.done";
      text?: string;
      summary_index?: number;
    }
  | {
      type: "response.reasoning_text.done";
      text?: string;
      content_index?: number;
    };

export interface AssistantStreamState {
  content: string;
  reasoningText: string;
  reasoningSummary: string;
  reasoningStatus?: ReasoningStatus;
  citations: UrlCitation[];
  imageBase64?: string;
  imageMimeType?: string;
  isGeneratingImage: boolean;
  isSearching: boolean;
  terminalStatus: AssistantStreamTerminalStatus;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

export function createInitialAssistantStreamState(
  usesReasoning: boolean
): AssistantStreamState {
  return {
    content: "",
    reasoningText: "",
    reasoningSummary: "",
    reasoningStatus: usesReasoning ? "thinking" : undefined,
    citations: [],
    imageBase64: undefined,
    imageMimeType: undefined,
    isGeneratingImage: false,
    isSearching: false,
    terminalStatus: "streaming",
  };
}

function appendCitation(
  citations: UrlCitation[],
  nextCitation: UrlCitation
): UrlCitation[] {
  if (citations.some((citation) => citation.url === nextCitation.url)) {
    return citations;
  }

  return [...citations, nextCitation];
}

function mergeCompletedText(current: string, completed: string | undefined): string {
  const next = completed?.trim();
  if (!next) return current;
  if (!current) return next;
  if (next.startsWith(current) || current === next) return next;
  if (current.includes(next)) return current;
  return `${current}\n\n${next}`;
}

export function reduceAssistantStreamEvent(
  state: AssistantStreamState,
  event: AssistantStreamEvent
): AssistantStreamState {
  switch (event.type) {
    case "response.output_text.delta":
      return {
        ...state,
        content: `${state.content}${event.delta || ""}`,
      };
    case "response.output_item.added":
      if (event.item?.type === "image_generation_call") {
        return { ...state, isGeneratingImage: true };
      }
      if (event.item?.type === "web_search_call") {
        return { ...state, isSearching: true };
      }
      return state;
    case "response.output_item.done":
      if (event.item?.type === "image_generation_call") {
        return {
          ...state,
          isGeneratingImage: false,
          ...(event.item.result
            ? {
                imageBase64: event.item.result,
                imageMimeType: "image/png",
              }
            : {}),
        };
      }
      if (event.item?.type === "web_search_call") {
        return { ...state, isSearching: false };
      }
      return state;
    case "response.image_generation_call.partial_image":
      return {
        ...state,
        imageBase64: event.partial_image_b64,
        imageMimeType: "image/png",
        isGeneratingImage: true,
      };
    case "response.output_text.annotation.added":
      if (
        event.annotation?.type === "url_citation" &&
        typeof event.annotation.url === "string" &&
        event.annotation.url.length > 0
      ) {
        return {
          ...state,
          citations: appendCitation(state.citations, {
            title: event.annotation.title || "",
            url: event.annotation.url,
          }),
        };
      }
      return state;
    case "response.reasoning_text.delta":
      return {
        ...state,
        reasoningText: `${state.reasoningText}${event.delta || ""}`,
        reasoningStatus: "thinking",
      };
    case "response.reasoning_summary_text.delta":
      return {
        ...state,
        reasoningSummary: `${state.reasoningSummary}${event.delta || ""}`,
        reasoningStatus: "thinking",
      };
    case "response.reasoning_summary_text.done":
      return {
        ...state,
        reasoningSummary: mergeCompletedText(state.reasoningSummary, event.text),
        reasoningStatus: "thinking",
      };
    case "response.reasoning_summary_part.added":
      if (event.part?.type !== "summary_text") return state;
      return {
        ...state,
        reasoningStatus: "thinking",
      };
    case "response.reasoning_summary_part.done":
      if (event.part?.type !== "summary_text") return state;
      return {
        ...state,
        reasoningSummary: mergeCompletedText(state.reasoningSummary, event.part.text),
        reasoningStatus: "thinking",
      };
    case "response.reasoning_text.done":
      return {
        ...state,
        reasoningText: mergeCompletedText(state.reasoningText, event.text),
        reasoningStatus: "thinking",
      };
    case "response.completed":
      return {
        ...state,
        inputTokens: event.response?.usage?.input_tokens,
        outputTokens: event.response?.usage?.output_tokens,
        cachedTokens: event.response?.usage?.input_tokens_details?.cached_tokens,
        reasoningTokens:
          event.response?.usage?.output_tokens_details?.reasoning_tokens,
      };
    default:
      return state;
  }
}

export function finalizeAssistantStreamState(
  state: AssistantStreamState,
  terminalStatus: Exclude<AssistantStreamTerminalStatus, "streaming">,
  usesReasoning: boolean
): AssistantStreamState {
  return {
    ...state,
    terminalStatus,
    isGeneratingImage: false,
    isSearching: false,
    reasoningStatus: usesReasoning ? "complete" : undefined,
  };
}

export function assistantStreamStateToMessagePatch(
  state: AssistantStreamState
): Partial<Message> {
  return {
    content: cleanCitationMarkers(state.content, state.citations),
    ...(state.reasoningText ? { reasoningText: state.reasoningText } : {}),
    ...(state.reasoningSummary ? { reasoningSummary: state.reasoningSummary } : {}),
    ...(state.reasoningStatus ? { reasoningStatus: state.reasoningStatus } : {}),
    ...(state.citations.length > 0 ? { citations: state.citations } : {}),
    ...(state.imageBase64 ? { imageBase64: state.imageBase64 } : {}),
    ...(state.imageMimeType ? { imageMimeType: state.imageMimeType } : {}),
    ...(state.inputTokens != null ? { inputTokens: state.inputTokens } : {}),
    ...(state.outputTokens != null ? { outputTokens: state.outputTokens } : {}),
    ...(state.cachedTokens != null ? { cachedTokens: state.cachedTokens } : {}),
    ...(state.reasoningTokens != null ? { reasoningTokens: state.reasoningTokens } : {}),
    streamStatus: state.terminalStatus,
    isGeneratingImage: state.isGeneratingImage,
    isSearching: state.isSearching,
  };
}

export function extractSsePayloads(buffer: string): {
  buffer: string;
  payloads: string[];
} {
  let nextBuffer = buffer;
  const payloads: string[] = [];

  let boundaryIndex = nextBuffer.indexOf("\n\n");
  while (boundaryIndex !== -1) {
    const rawEvent = nextBuffer.slice(0, boundaryIndex).trim();
    nextBuffer = nextBuffer.slice(boundaryIndex + 2);

    if (rawEvent.length > 0) {
      const dataLine = rawEvent
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (dataLine) {
        payloads.push(dataLine.replace("data: ", "").trim());
      }
    }

    boundaryIndex = nextBuffer.indexOf("\n\n");
  }

  return {
    buffer: nextBuffer,
    payloads,
  };
}
