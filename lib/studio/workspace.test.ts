import { describe, expect, it } from "vitest";
import {
  applyStudioWorkspaceMutation,
  createInitialStudioWorkspace,
  parseStudioWorkspace,
  readStudioWorkspaceFromStorage,
  writeStudioWorkspaceToStorage,
} from "@/lib/studio/workspace";

describe("Studio workspace persistence", () => {
  it("enables autocomplete by default in a new workspace", () => {
    expect(createInitialStudioWorkspace().autocompleteEnabled).toBe(true);
  });

  it("normalizes legacy v1 snapshots without an autocomplete preference to enabled", () => {
    const initial = createInitialStudioWorkspace();
    const legacy = { ...initial, autocompleteEnabled: undefined };

    expect(
      parseStudioWorkspace(JSON.stringify(legacy)).autocompleteEnabled
    ).toBe(true);
  });

  it("restores an explicitly disabled autocomplete preference", () => {
    const initial = createInitialStudioWorkspace();
    const restored = parseStudioWorkspace(
      JSON.stringify({ ...initial, autocompleteEnabled: false })
    );

    expect(restored.version).toBe(1);
    expect(restored.autocompleteEnabled).toBe(false);
  });

  it("creates the calculator project shown in the approved concept", () => {
    const workspace = createInitialStudioWorkspace();

    expect(workspace.activeFilePath).toBe("src/utils/calculadora.ts");
    expect(workspace.openFilePaths).toHaveLength(3);
    expect(workspace.files[workspace.activeFilePath].content).toContain(
      'console.log("Resultado:", demo.resultado)'
    );
    expect(workspace.selectedModelId).toBe("gpt-5.6-luna");
  });

  it("recovers safely from invalid persisted JSON", () => {
    expect(parseStudioWorkspace("{invalid").activeFilePath).toBe(
      "src/utils/calculadora.ts"
    );
  });

  it("drops invalid open paths without losing the active file", () => {
    const initial = createInitialStudioWorkspace();
    const parsed = parseStudioWorkspace(
      JSON.stringify({
        ...initial,
        openFilePaths: ["missing.ts"],
        activeFilePath: "src/index.ts",
      })
    );

    expect(parsed.openFilePaths).toEqual(["src/index.ts"]);
    expect(parsed.activeFilePath).toBe("src/index.ts");
  });

  it("restores edited files, open tabs, model and assistant history across sessions", () => {
    const initial = createInitialStudioWorkspace();
    const edited = {
      ...initial,
      activeFilePath: "src/index.ts",
      openFilePaths: ["src/index.ts", "README.md"],
      selectedModelId: "gpt-5.6-terra" as const,
      files: {
        ...initial.files,
        "src/index.ts": {
          ...initial.files["src/index.ts"],
          content: 'console.log("sessao persistida")',
        },
      },
      assistantMessages: [
        ...initial.assistantMessages,
        {
          id: "persisted-question",
          role: "user" as const,
          content: "Lembre desta pergunta no Studio.",
          createdAt: "2026-08-06T15:00:00.000Z",
          status: "completed" as const,
        },
      ],
    };

    const restored = parseStudioWorkspace(JSON.stringify(edited));

    expect(restored.activeFilePath).toBe("src/index.ts");
    expect(restored.openFilePaths).toEqual(["src/index.ts", "README.md"]);
    expect(restored.files["src/index.ts"].content).toContain("sessao persistida");
    expect(restored.selectedModelId).toBe("gpt-5.6-terra");
    expect(restored.assistantMessages.at(-1)?.id).toBe("persisted-question");
  });

  it("migrates only the untouched legacy index that imported another file", () => {
    const initial = createInitialStudioWorkspace();
    const restored = parseStudioWorkspace(
      JSON.stringify({
        ...initial,
        files: {
          ...initial.files,
          "src/index.ts": {
            ...initial.files["src/index.ts"],
            content:
              'import { calcular } from "./utils/calculadora";\n\nconsole.log(calcular({ a: 20, b: 22, operacao: "soma" }));',
          },
        },
      })
    );

    expect(restored.files["src/index.ts"].content).toContain(
      "Gaucho Studio pronto"
    );
    expect(restored.files["src/index.ts"].content).not.toContain("import");
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
    expect(result.workspace.activeFilePath).toBe("src/utils/calculadora.ts");
  });

  it("retries quota failures without assistant history so code still persists", () => {
    const writes: string[] = [];
    const initial = createInitialStudioWorkspace();
    const workspace = {
      ...initial,
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
      files?: Record<string, unknown>;
      assistantMessages?: unknown[];
    };
    expect(persisted.files?.["src/utils/calculadora.ts"]).toBeTruthy();
    expect(persisted.assistantMessages).toEqual([]);
  });
});
