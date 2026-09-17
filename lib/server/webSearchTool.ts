import type OpenAI from "openai";

export function buildWebSearchTool(): OpenAI.Responses.WebSearchPreviewTool {
  return {
    type: "web_search_preview",
    search_context_size: "medium",
    user_location: { type: "approximate", country: "BR" },
  };
}
