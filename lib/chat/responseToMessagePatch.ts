import type OpenAI from "openai";
import type { Message, UrlCitation } from "@/types";
import { cleanCitationMarkers } from "@/lib/artifacts/messageArtifacts";

type ResponseLike = OpenAI.Responses.Response & {
  output_text?: string;
};

type OutputContent = {
  type?: string;
  text?: string;
  annotations?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
};

type OutputItem = {
  type?: string;
  status?: string;
  result?: string;
  content?: OutputContent[];
};

function dedupeCitations(citations: UrlCitation[]): UrlCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    if (!citation.url || seen.has(citation.url)) return false;
    seen.add(citation.url);
    return true;
  });
}

function extractOutput(response: ResponseLike) {
  const textParts: string[] = [];
  const citations: UrlCitation[] = [];
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    textParts.push(response.output_text.trim());
  }

  for (const item of (response.output ?? []) as OutputItem[]) {
    if (item.type === "image_generation_call" && item.result) {
      imageBase64 = item.result;
      imageMimeType = "image/png";
      continue;
    }

    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) {
        textParts.push(content.text.trim());
      }

      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          citations.push({
            title: annotation.title ?? "",
            url: annotation.url,
          });
        }
      }
    }
  }

  return {
    content: cleanCitationMarkers(
      Array.from(new Set(textParts)).join("\n\n").trim(),
      dedupeCitations(citations)
    ),
    citations: dedupeCitations(citations),
    imageBase64,
    imageMimeType,
  };
}

export function responseToMessagePatch(
  response: OpenAI.Responses.Response
): Partial<Message> {
  const output = extractOutput(response as ResponseLike);
  const usage = response.usage;

  if (response.status === "cancelled") {
    return {
      streamStatus: "aborted",
      isGeneratingImage: false,
      isSearching: false,
    };
  }

  if (response.status === "failed" || response.status === "incomplete" || response.error) {
    return {
      streamStatus: "failed",
      content:
        response.error?.message ||
        (response.status === "incomplete"
          ? "❌ A geração em segundo plano terminou incompleta antes de devolver uma resposta final."
          : "❌ A geração em segundo plano falhou antes de devolver uma resposta."),
      isGeneratingImage: false,
      isSearching: false,
    };
  }

  if (response.status !== "completed") {
    return {
      streamStatus: "streaming",
      isGeneratingImage: false,
      isSearching: true,
    };
  }

  return {
    content: output.content,
    ...(output.citations.length > 0 ? { citations: output.citations } : {}),
    ...(output.imageBase64 ? { imageBase64: output.imageBase64 } : {}),
    ...(output.imageMimeType ? { imageMimeType: output.imageMimeType } : {}),
    ...(usage?.input_tokens != null ? { inputTokens: usage.input_tokens } : {}),
    ...(usage?.output_tokens != null ? { outputTokens: usage.output_tokens } : {}),
    ...(usage?.input_tokens_details?.cached_tokens != null
      ? { cachedTokens: usage.input_tokens_details.cached_tokens }
      : {}),
    ...(usage?.output_tokens_details?.reasoning_tokens != null
      ? { reasoningTokens: usage.output_tokens_details.reasoning_tokens }
      : {}),
    streamStatus: "completed",
    reasoningStatus: "complete",
    isGeneratingImage: false,
    isSearching: false,
  };
}
