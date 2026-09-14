// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/types";
import { useChatStore } from "@/stores/chatStore";

const storage = vi.hoisted(() => ({
  conversations: new Map<string, Message[]>(),
  saveConversationMessages: vi.fn(async () => undefined),
  saveConversationMessagesAndTitle: vi.fn(async () => undefined),
}));

vi.mock("@/lib/storage/conversations", () => ({
  listConversations: vi.fn(async () =>
    ["A", "B"].map((id) => ({
      id,
      title: id,
      messages: storage.conversations.get(id) ?? [],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }))
  ),
  getConversation: vi.fn(async (id: string) => ({
    id,
    title: id,
    messages: storage.conversations.get(id) ?? [],
  })),
  createConversation: vi.fn(async () => "created"),
  saveConversationMessages: storage.saveConversationMessages,
  saveConversationMessagesAndTitle: storage.saveConversationMessagesAndTitle,
  saveConversationMessagesViaBeacon: vi.fn(),
}));
vi.mock("@/lib/storage/conversationPersistence", () => ({
  withConversationPersistenceRetry: (action: () => Promise<unknown>) => action(),
}));
vi.mock("@/lib/storage/memoryRag", () => ({
  searchMemoryContext: vi.fn(async () => []),
}));
vi.mock("@/lib/chat/memoryRefresh", () => ({
  refreshConversationMemoryLayer: vi.fn(async () => undefined),
}));
vi.mock("@/hooks/useCustomInstructions", () => ({
  useCustomInstructions: () => ({
    contextAboutUser: "",
    responsePreferences: "",
    customSystemInstructions: "",
  }),
}));
vi.mock("@/hooks/useMemories", () => ({
  useMemories: () => ({ memories: [] }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { useChat } from "@/hooks/useChat";

type ChatApi = ReturnType<typeof useChat>;

interface PendingStream {
  signal: AbortSignal;
  body: string;
}

const streams: PendingStream[] = [];
const ABORT_REJECTION_DELAY_MS = 20;
let reconcileResults: Array<{ conversationId: string; message: Message }> = [];

function installFetchMock() {
  streams.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (!String(url).endsWith("/api/chat")) {
        const results = String(url).endsWith("/reconcile") ? reconcileResults : [];
        return Promise.resolve(
          new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      const signal = init?.signal as AbortSignal;
      streams.push({ signal, body: String(init?.body ?? "") });
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          // Em produção a rejeição chega numa task posterior ao abort (o
          // reader.read() só falha depois); o atraso reproduz a janela real.
          setTimeout(
            () => reject(new DOMException("aborted", "AbortError")),
            ABORT_REJECTION_DELAY_MS
          );
        });
      });
    })
  );
}

function message(id: string, role: Message["role"], content: string): Message {
  return { id, role, content, timestamp: new Date(0) };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let latest: ChatApi | null = null;

function Harness({ onApi }: { onApi: (chat: ChatApi) => void }) {
  const chat = useChat();
  useEffect(() => {
    onApi(chat);
  });
  return null;
}

async function mountHook() {
  const queryClient = new QueryClient();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Harness, {
          onApi: (chat: ChatApi) => {
            latest = chat;
          },
        })
      )
    );
  });
  await settle();
}

async function settle(ms = 5) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function api(): ChatApi {
  if (!latest) throw new Error("hook not mounted");
  return latest;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  installFetchMock();
  reconcileResults = [];
  storage.conversations.clear();
  storage.saveConversationMessages.mockClear();
  storage.saveConversationMessagesAndTitle.mockClear();
  useChatStore.setState({ activeConversationId: "A", messages: [], isStreaming: false });
});

afterEach(async () => {
  // Drena rejeições tardias de streams abortados antes de desmontar, senão o
  // catch/finally do teste anterior roda dentro do teste seguinte.
  await settle(ABORT_REJECTION_DELAY_MS * 3);
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latest = null;
  vi.unstubAllGlobals();
});

describe("useChat — Parar, reenviar e reconcile", () => {
  it("keeps the newer send stoppable and loading after the aborted stream settles", async () => {
    await mountHook();

    await act(async () => {
      void api().sendMessage("um");
    });
    await settle();
    expect(streams).toHaveLength(1);
    expect(api().isLoading).toBe(true);

    await act(async () => {
      api().stopGeneration();
    });
    expect(streams[0].signal.aborted).toBe(true);
    expect(api().isLoading).toBe(false);

    await act(async () => {
      void api().sendMessage("dois");
    });
    await settle();
    expect(streams).toHaveLength(2);

    // Deixa o catch/finally do stream antigo rodar por completo.
    await settle(ABORT_REJECTION_DELAY_MS * 3);

    expect(api().isLoading).toBe(true);
    expect(useChatStore.getState().isStreaming).toBe(true);
    expect(streams[1].signal.aborted).toBe(false);

    await act(async () => {
      api().stopGeneration();
    });
    expect(streams[1].signal.aborted).toBe(true);
  });

  it("never persists another conversation's messages under the aborted conversation id", async () => {
    storage.conversations.set("B", [
      message("b-user", "user", "mensagem da B"),
      message("b-assistant", "assistant", "resposta da B"),
    ]);
    await mountHook();

    await act(async () => {
      void api().sendMessage("um");
    });
    await settle();
    expect(streams).toHaveLength(1);

    await act(async () => {
      api().stopGeneration();
      useChatStore.getState().setActiveConversationId("B");
    });
    // Recovery da B e rejeição tardia do stream da A.
    await settle(ABORT_REJECTION_DELAY_MS * 3);

    const savesForA = storage.saveConversationMessages.mock.calls
      .map((call) => call as unknown as [string, Message[]])
      .filter(([conversationId]) => conversationId === "A");
    expect(savesForA.length).toBeGreaterThan(0);
    for (const [, saved] of savesForA) {
      expect(saved.some((item) => item.content === "um")).toBe(true);
      expect(saved.some((item) => item.id.startsWith("b-"))).toBe(false);
    }
    const titleSavesForA = storage.saveConversationMessagesAndTitle.mock.calls
      .map((call) => call as unknown as [string, Message[], string])
      .filter(([conversationId]) => conversationId === "A");
    for (const [, saved] of titleSavesForA) {
      expect(saved.some((item) => item.id.startsWith("b-"))).toBe(false);
    }
    expect(useChatStore.getState().messages.map((item) => item.id)).toEqual([
      "b-user",
      "b-assistant",
    ]);
  });

  it("keeps a live stream loading when a reconcile only touches other conversations (B2)", async () => {
    await mountHook();

    await act(async () => {
      void api().sendMessage("um");
    });
    await settle();
    expect(streams).toHaveLength(1);
    expect(api().isLoading).toBe(true);

    reconcileResults = [
      {
        conversationId: "B",
        message: {
          ...message("b-assistant", "assistant", "resposta da B"),
          backgroundJob: {
            status: "completed",
            responseId: "resp-b",
            startedAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        },
      },
    ];
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();

    expect(api().isLoading).toBe(true);
    expect(useChatStore.getState().isStreaming).toBe(true);
    expect(streams[0].signal.aborted).toBe(false);

    await act(async () => {
      api().stopGeneration();
    });
    expect(streams[0].signal.aborted).toBe(true);
  });
});
