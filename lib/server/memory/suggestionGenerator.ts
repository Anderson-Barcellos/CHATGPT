import "server-only";

import type { Conversation, MemoryCategory, MemorySuggestion } from "@/types";
import { createOpenAIClient, DEFAULT_CHAT_MODEL } from "@/lib/server/chatRequest";
import { messageToRetrievalText } from "@/lib/server/memory/chunking";
import { createMemorySuggestions } from "@/lib/server/memory/suggestionsStore";

const MAX_RECENT_EXCHANGE_CHARS = 7000;

interface SuggestedMemoryPayload {
  content: string;
  category?: MemoryCategory;
  confidence?: number;
}

const VALID_CATEGORIES = new Set<MemoryCategory>([
  "personal",
  "professional",
  "preferences",
  "projects",
  "technical",
  "other",
]);

function extractOutputText(response: unknown): string {
  if (
    response &&
    typeof response === "object" &&
    "output_text" in response &&
    typeof (response as { output_text?: unknown }).output_text === "string"
  ) {
    return (response as { output_text: string }).output_text;
  }
  return "";
}

function getRecentExchange(conversation: Conversation) {
  const completed = conversation.messages.filter((message) => {
    if (message.role === "assistant") return message.streamStatus === "completed";
    return true;
  });

  const recent = completed.slice(-6);
  const sourceMessageIds = recent.map((message) => message.id);
  const text = recent
    .map((message) => {
      const label = message.role === "user" ? "USER" : "ASSISTANT";
      return `[${label}] ${messageToRetrievalText(message)}`;
    })
    .join("\n\n")
    .slice(-MAX_RECENT_EXCHANGE_CHARS);

  return { text, sourceMessageIds };
}

function parseSuggestions(raw: string): SuggestedMemoryPayload[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  if (!cleaned) return [];

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "memories" in parsed
      ? (parsed as { memories?: unknown }).memories
      : [];

    if (!Array.isArray(items)) return [];

    return items
      .map((item) => item as SuggestedMemoryPayload)
      .filter((item) => typeof item.content === "string" && item.content.trim())
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateMemorySuggestionsForConversation(
  conversation: Conversation
): Promise<MemorySuggestion[]> {
  const { text, sourceMessageIds } = getRecentExchange(conversation);
  if (!text.trim()) return [];

  const openai = createOpenAIClient();
  if (!openai) return [];

  const response = await openai.responses.create({
    model: DEFAULT_CHAT_MODEL,
    instructions:
      "Voce extrai memorias candidatas para um chat pessoal. Retorne somente JSON valido. Sugira apenas fatos, preferencias ou projetos duraveis. Nao sugira informacoes vagas, temporarias, sensiveis por inferencia, nem algo que ja dependa de adivinhacao.",
    input: `Conversa recente:\n\n${text}\n\nRetorne {"memories":[{"content":"...","category":"personal|professional|preferences|projects|technical|other","confidence":0.0}]}. Se nada deve virar memoria, retorne {"memories":[]}.`,
    max_output_tokens: 700,
  });

  const candidates = parseSuggestions(extractOutputText(response)).map((item) => ({
    content: item.content.trim(),
    category:
      item.category && VALID_CATEGORIES.has(item.category)
        ? item.category
        : ("other" as const),
    confidence:
      typeof item.confidence === "number"
        ? Math.min(Math.max(item.confidence, 0), 1)
        : 0.5,
    sourceConversationId: conversation.id,
    sourceMessageIds,
  }));

  if (candidates.length === 0) return [];
  return createMemorySuggestions(candidates);
}
