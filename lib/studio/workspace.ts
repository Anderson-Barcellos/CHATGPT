import { DEFAULT_STUDIO_MODEL_ID, isStudioModelId } from "@/lib/studio/models";
import type {
  StudioAssistantMessage,
  StudioWorkspaceSnapshot,
} from "@/lib/studio/types";

export const STUDIO_STORAGE_KEY = "gaucho-studio:workspace:v1";
export const STUDIO_MAX_ASSISTANT_MESSAGES = 50;

interface StudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createInitialStudioWorkspace(): StudioWorkspaceSnapshot {
  return {
    version: 2,
    autocompleteEnabled: true,
    assistantMessages: [],
    selectedModelId: DEFAULT_STUDIO_MODEL_ID,
  };
}

function normalizeMessages(value: unknown): StudioAssistantMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }

    const message = candidate as Partial<StudioAssistantMessage>;
    // A era v1 semeava uma conversa demo com ids "studio-welcome-*"; ela não é
    // histórico real e é descartada em qualquer snapshot persistido.
    if (typeof message.id === "string" && message.id.startsWith("studio-welcome-")) {
      return [];
    }
    if (
      typeof message.id !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      typeof message.createdAt !== "string"
    ) {
      return [];
    }

    const wasInterrupted =
      message.role === "assistant" &&
      (message.status === "streaming" || message.status === "interrupted");

    return [
      {
        id: message.id,
        role: message.role,
        content:
          wasInterrupted && !message.content.trim()
            ? "Resposta interrompida."
            : message.content,
        createdAt: message.createdAt,
        status: message.status === "failed"
          ? "failed"
          : wasInterrupted
            ? "interrupted"
            : "completed",
      } satisfies StudioAssistantMessage,
    ];
  }).slice(-STUDIO_MAX_ASSISTANT_MESSAGES);
}

export function limitStudioAssistantMessages(
  messages: StudioAssistantMessage[]
): StudioAssistantMessage[] {
  return messages.slice(-STUDIO_MAX_ASSISTANT_MESSAGES);
}

export function applyStudioWorkspaceMutation(
  current: StudioWorkspaceSnapshot,
  mutator: (
    current: StudioWorkspaceSnapshot
  ) => StudioWorkspaceSnapshot
): { workspace: StudioWorkspaceSnapshot; changed: boolean } {
  const workspace = mutator(current);
  return { workspace, changed: workspace !== current };
}

export function parseStudioWorkspace(
  raw: string | null
): StudioWorkspaceSnapshot {
  const fallback = createInitialStudioWorkspace();
  if (!raw) return fallback;

  try {
    const candidate = JSON.parse(raw) as {
      version?: unknown;
      autocompleteEnabled?: unknown;
      assistantMessages?: unknown;
      selectedModelId?: unknown;
    };
    // v1 (era com arquivos TS locais) migra preservando só as preferências e
    // o histórico do assistente; qualquer outra versão volta ao inicial.
    if (candidate.version !== 1 && candidate.version !== 2) return fallback;

    return {
      version: 2,
      autocompleteEnabled:
        typeof candidate.autocompleteEnabled === "boolean"
          ? candidate.autocompleteEnabled
          : true,
      assistantMessages: normalizeMessages(candidate.assistantMessages),
      selectedModelId: isStudioModelId(candidate.selectedModelId)
        ? candidate.selectedModelId
        : DEFAULT_STUDIO_MODEL_ID,
    };
  } catch {
    return fallback;
  }
}

export function readStudioWorkspaceFromStorage(storage: StudioStorage): {
  workspace: StudioWorkspaceSnapshot;
  ok: boolean;
} {
  try {
    return {
      workspace: parseStudioWorkspace(storage.getItem(STUDIO_STORAGE_KEY)),
      ok: true,
    };
  } catch {
    return { workspace: createInitialStudioWorkspace(), ok: false };
  }
}

export function writeStudioWorkspaceToStorage(
  storage: StudioStorage,
  workspace: StudioWorkspaceSnapshot
): boolean {
  const boundedWorkspace = {
    ...workspace,
    assistantMessages: limitStudioAssistantMessages(
      workspace.assistantMessages
    ),
  };

  try {
    storage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(boundedWorkspace));
    return true;
  } catch {
    try {
      storage.setItem(
        STUDIO_STORAGE_KEY,
        JSON.stringify({ ...boundedWorkspace, assistantMessages: [] })
      );
      return true;
    } catch {
      return false;
    }
  }
}
