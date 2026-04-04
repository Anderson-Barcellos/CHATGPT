import {
  Conversation,
  ModelParameters,
  CustomInstructions,
  Memory,
} from "@/types";

export const EXPORT_FORMAT_VERSION = "1.0.0";

export interface JSONExportData {
  version: string;
  exportDate: string;
  conversation: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: string;
      reasoningSummary?: string;
      reasoningText?: string;
      imageBase64?: string;
      imageMimeType?: string;
      artifact?: Conversation["messages"][number]["artifact"];
    }>;
  };
  metadata?: {
    modelParameters?: ModelParameters;
    customInstructions?: CustomInstructions;
    activeMemories?: Memory[];
  };
}

export interface JSONExportOptions {
  includeMetadata?: boolean;
  includeImages?: boolean;
  pretty?: boolean;
}

export function exportToJSON(
  conversation: Conversation,
  options: JSONExportOptions = {},
  metadata?: {
    modelParameters?: ModelParameters;
    customInstructions?: CustomInstructions;
    activeMemories?: Memory[];
  }
): string {
  const { includeMetadata = true, includeImages = true, pretty = true } = options;

  const exportData: JSONExportData = {
    version: EXPORT_FORMAT_VERSION,
    exportDate: new Date().toISOString(),
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: new Date(conversation.createdAt).toISOString(),
      updatedAt: new Date(conversation.updatedAt).toISOString(),
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).toISOString(),
        reasoningSummary: msg.reasoningSummary,
        reasoningText: msg.reasoningText,
        imageBase64: includeImages ? msg.imageBase64 : undefined,
        imageMimeType: includeImages ? msg.imageMimeType : undefined,
        artifact: msg.artifact,
      })),
    },
  };

  if (includeMetadata && metadata) {
    exportData.metadata = metadata;
  }

  return JSON.stringify(exportData, null, pretty ? 2 : 0);
}

export function downloadJSON(
  conversation: Conversation,
  options?: JSONExportOptions,
  metadata?: {
    modelParameters?: ModelParameters;
    customInstructions?: CustomInstructions;
    activeMemories?: Memory[];
  }
): void {
  const json = exportToJSON(conversation, options, metadata);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(conversation.title)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseImport(jsonString: string): {
  valid: boolean;
  data?: JSONExportData;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString) as JSONExportData;

    if (!data.version) {
      return { valid: false, error: "Invalid format: missing version" };
    }

    if (!data.conversation || !data.conversation.messages) {
      return { valid: false, error: "Invalid format: missing conversation data" };
    }

    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function importFromJSON(data: JSONExportData): Conversation {
  return {
    id: data.conversation.id,
    title: data.conversation.title,
    createdAt: new Date(data.conversation.createdAt),
    updatedAt: new Date(data.conversation.updatedAt),
    messages: data.conversation.messages.map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      reasoningSummary: msg.reasoningSummary,
      reasoningText: msg.reasoningText,
      imageBase64: msg.imageBase64,
      imageMimeType: msg.imageMimeType,
      artifact: msg.artifact,
    })),
  };
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, 100);
}
