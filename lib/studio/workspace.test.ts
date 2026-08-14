import { describe, expect, it } from "vitest";
import {
  applyStudioWorkspaceMutation,
  createInitialStudioWorkspace,
  parseStudioWorkspace,
  readStudioWorkspaceFromStorage,
  writeStudioWorkspaceToStorage,
} from "@/lib/studio/workspace";

describe("Studio prefs persistence", () => {
  it("enables autocomplete by default in a new snapshot", () => {
    const workspace = createInitialStudioWorkspace();

    expect(workspace.version).toBe(2);
    expect(workspace.autocompleteEnabled).toBe(true);
    expect(workspace.assistantMessages).toEqual([]);
    expect(workspace.selectedModelId).toBe("gpt-5.6-luna");
  });

  it("restores an explicitly disabled autocomplete preference", () => {
    const initial = createInitialStudioWorkspace();
    const restored = parseStudioWorkspace(
      JSON.stringify({ ...initial, autocompleteEnabled: false })
    );

    expect(restored.version).toBe(2);
    expect(restored.autocompleteEnabled).toBe(false);
  });

  it("migrates a legacy v1 snapshot keeping prefs and assistant history", () => {
    const legacy = {
      version: 1,
      autocompleteEnabled: false,
      files: {
        "src/index.ts": {
          path: "src/index.ts",
          name: "index.ts",
          language: "typescript",
          content: "console.log(1)",
        },
      },
      openFilePaths: ["src/index.ts"],
      activeFilePath: "src/index.ts",
      selectedModelId: "gpt-5.6-terra",
      assistantMessages: [
        {
          id: "legacy-question",
          role: "user",
          content: "Pergunta preservada da era TS.",
          createdAt: "2026-08-06T15:00:00.000Z",
          status: "completed",
        },
      ],
    };

    const restored = parseStudioWorkspace(JSON.stringify(legacy));

    expect(restored.version).toBe(2);
    expect(restored.autocompleteEnabled).toBe(false);
    expect(restored.selectedModelId).toBe("gpt-5.6-terra");
    expect(restored.assistantMessages).toEqual([
      expect.objectContaining({ id: "legacy-question" }),
    ]);
    expect("files" in restored).toBe(false);
  });

  it("drops the seeded v1 demo conversation while keeping real history", () => {
    const persisted = {
      version: 2,
      autocompleteEnabled: true,
      selectedModelId: "gpt-5.6-luna",
      assistantMessages: [
        {
          id: "studio-welcome-user",
          role: "user",
          content: "Revise esta função e sugira uma versão mais segura.",
          createdAt: "2026-08-06T17:22:00.000Z",
          status: "completed",
        },
        {
          id: "studio-welcome-assistant",
          role: "assistant",
          content: "Sua função já tem boas validações...",
          createdAt: "2026-08-06T17:22:05.000Z",
          status: "completed",
        },
        {
          id: "studio-1755000000-real",
          role: "user",
          content: "Pergunta real do Anders.",
          createdAt: "2026-08-13T10:00:00.000Z",
          status: "completed",
        },
      ],
    };

    const restored = parseStudioWorkspace(JSON.stringify(persisted));

    expect(restored.assistantMessages).toEqual([
      expect.objectContaining({ id: "studio-1755000000-real" }),
    ]);
  });

  it("recovers safely from invalid persisted JSON", () => {
    const restored = parseStudioWorkspace("{invalid");

    expect(restored.version).toBe(2);
    expect(restored.autocompleteEnabled).toBe(true);
  });

  it("falls back to the default model for unknown model ids", () => {
    const restored = parseStudioWorkspace(
      JSON.stringify({
        ...createInitialStudioWorkspace(),
        selectedModelId: "modelo-que-nao-existe",
      })
    );

    expect(restored.selectedModelId).toBe("gpt-5.6-luna");
  });

  it("restores an in-flight assistant response with an explicit interrupted status", () => {
    const initial = createInitialStudioWorkspace();
    const restored = parseStudioWorkspace(
      JSON.stringify({
        ...initial,
        assistantMessages: [
          {
            id: "streaming-response",
            role: "assistant",
            content: "",
            createdAt: "2026-08-06T15:00:00.000Z",
            status: "streaming",
          },
        ],
      })
    );

    expect(restored.assistantMessages).toEqual([
      expect.objectContaining({
        id: "streaming-response",
        content: "Resposta interrompida.",
        status: "interrupted",
      }),
    ]);
  });

  it("keeps only the latest bounded assistant history", () => {
    const initial = createInitialStudioWorkspace();
    const restored = parseStudioWorkspace(
      JSON.stringify({
        ...initial,
        assistantMessages: Array.from({ length: 80 }, (_, index) => ({
          id: `message-${index}`,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `conteudo-${index}`,
          createdAt: "2026-08-06T15:00:00.000Z",
          status: "completed",
        })),
      })
    );

    expect(restored.assistantMessages).toHaveLength(50);
    expect(restored.assistantMessages[0]?.id).toBe("message-30");
    expect(restored.assistantMessages.at(-1)?.id).toBe("message-79");
  });

  it("reports a no-op mutation without changing the snapshot", () => {
    const initial = createInitialStudioWorkspace();
    const result = applyStudioWorkspaceMutation(initial, (current) => current);

    expect(result).toEqual({ workspace: initial, changed: false });
  });

  it("recovers when localStorage read is unavailable", () => {
    const result = readStudioWorkspaceFromStorage({
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {},
    });

    expect(result.ok).toBe(false);
    expect(result.workspace.version).toBe(2);
  });

  it("retries quota failures without assistant history so prefs still persist", () => {
    const writes: string[] = [];
    const initial = createInitialStudioWorkspace();
    const workspace = {
      ...initial,
      autocompleteEnabled: false,
      assistantMessages: Array.from({ length: 50 }, (_, index) => ({
        id: `large-${index}`,
        role: "assistant" as const,
        content: "x".repeat(10_000),
        createdAt: "2026-08-06T15:00:00.000Z",
        status: "completed" as const,
      })),
    };
    const storage = {
      getItem: () => null,
      setItem(_key: string, value: string) {
        if (value.length > 100_000) throw new Error("quota");
        writes.push(value);
      },
    };

    expect(writeStudioWorkspaceToStorage(storage, workspace)).toBe(true);
    const persisted = JSON.parse(writes[0] ?? "{}") as {
      autocompleteEnabled?: boolean;
      assistantMessages?: unknown[];
    };
    expect(persisted.autocompleteEnabled).toBe(false);
    expect(persisted.assistantMessages).toEqual([]);
  });
});
