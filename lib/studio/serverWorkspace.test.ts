import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendRunEvent,
  buildWorkspaceTreeRows,
  createRunEventParser,
  createServerWorkspaceController,
  createInitialServerRunResult,
  filterVisibleTreeRows,
  languageForWorkspacePath,
  pickDefaultWorkspaceFile,
  type StudioServerWorkspaceController,
} from "@/lib/studio/serverWorkspace";
import type {
  StudioWorkspaceRunEvent,
  StudioWorkspaceTreeEntry,
} from "@/lib/studio/workspaceServerProtocol";

function treeEntry(
  path: string,
  kind: "file" | "directory",
  overrides: Partial<StudioWorkspaceTreeEntry> = {}
): StudioWorkspaceTreeEntry {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    kind,
    size: kind === "file" ? 10 : 0,
    editable: kind === "file",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lockedResponse(): Response {
  return jsonResponse(
    {
      error: "Studio workspace locked",
      message: "Desbloqueie o workspace.",
      code: "studio_workspace_locked",
    },
    401
  );
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await Promise.resolve();
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

const RUN_EVENTS = {
  log: (text: string): StudioWorkspaceRunEvent => ({
    type: "console",
    level: "log",
    text,
  }),
  error: (text: string): StudioWorkspaceRunEvent => ({
    type: "console",
    level: "error",
    text,
  }),
  status: (
    status: "completed" | "failed" | "timeout" | "aborted",
    durationMs: number
  ): StudioWorkspaceRunEvent => ({ type: "status", status, durationMs }),
};

function frame(event: StudioWorkspaceRunEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe("languageForWorkspacePath", () => {
  it("maps workspace file extensions to editor languages", () => {
    expect(languageForWorkspacePath("main.py")).toBe("python");
    expect(languageForWorkspacePath("utils/helpers.py")).toBe("python");
    expect(languageForWorkspacePath("README.md")).toBe("markdown");
    expect(languageForWorkspacePath("config.json")).toBe("json");
    expect(languageForWorkspacePath("script.js")).toBe("javascript");
    expect(languageForWorkspacePath("mod.ts")).toBe("typescript");
    expect(languageForWorkspacePath("notas.txt")).toBe("plaintext");
    expect(languageForWorkspacePath("LICENSE")).toBe("plaintext");
  });
});

describe("buildWorkspaceTreeRows", () => {
  it("nests children under directories with dirs first and depth by segments", () => {
    const rows = buildWorkspaceTreeRows([
      treeEntry("README.md", "file"),
      treeEntry("main.py", "file"),
      treeEntry("utils", "directory"),
      treeEntry("utils/__init__.py", "file"),
      treeEntry("utils/helpers.py", "file"),
    ]);

    expect(rows.map((row) => row.entry.path)).toEqual([
      "utils",
      "utils/__init__.py",
      "utils/helpers.py",
      "main.py",
      "README.md",
    ]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 0, 0]);
  });
});

describe("filterVisibleTreeRows", () => {
  it("hides every row under a collapsed directory, including nested ones", () => {
    const rows = buildWorkspaceTreeRows([
      treeEntry("main.py", "file"),
      treeEntry("utils", "directory"),
      treeEntry("utils/helpers.py", "file"),
      treeEntry("utils/interno", "directory"),
      treeEntry("utils/interno/fundo.py", "file"),
      treeEntry("docs", "directory"),
      treeEntry("docs/nota.md", "file"),
    ]);

    const visible = filterVisibleTreeRows(rows, new Set(["utils"]));
    expect(visible.map((row) => row.entry.path)).toEqual([
      "docs",
      "docs/nota.md",
      "utils",
      "main.py",
    ]);

    const nested = filterVisibleTreeRows(rows, new Set(["utils/interno"]));
    expect(nested.map((row) => row.entry.path)).toEqual([
      "docs",
      "docs/nota.md",
      "utils",
      "utils/interno",
      "utils/helpers.py",
      "main.py",
    ]);

    expect(filterVisibleTreeRows(rows, new Set())).toEqual(rows);
  });
});

describe("pickDefaultWorkspaceFile", () => {
  it("prefers main.py at the root, falling back to the first editable file", () => {
    expect(
      pickDefaultWorkspaceFile(
        buildWorkspaceTreeRows([
          treeEntry("README.md", "file"),
          treeEntry("main.py", "file"),
        ])
      )
    ).toBe("main.py");
    expect(
      pickDefaultWorkspaceFile(
        buildWorkspaceTreeRows([
          treeEntry("dados.bin", "file", { editable: false }),
          treeEntry("utils", "directory"),
          treeEntry("utils/helpers.py", "file"),
        ])
      )
    ).toBe("utils/helpers.py");
    expect(pickDefaultWorkspaceFile([])).toBeNull();
  });
});

describe("createRunEventParser", () => {
  it("parses frames split across chunks", () => {
    const parser = createRunEventParser();
    const first = frame(RUN_EVENTS.log("olá"));
    const second = frame(RUN_EVENTS.status("completed", 42));
    const boundary = 6;

    const initial = parser.push(first + second.slice(0, boundary));
    expect(initial).toEqual([RUN_EVENTS.log("olá")]);

    const rest = parser.push(second.slice(boundary));
    expect(rest).toEqual([RUN_EVENTS.status("completed", 42)]);
  });

  it("ignores malformed frames without throwing", () => {
    const parser = createRunEventParser();
    const events = parser.push(
      "data: {not-json}\n\n" + frame(RUN_EVENTS.log("segue"))
    );
    expect(events).toEqual([RUN_EVENTS.log("segue")]);
  });
});

describe("appendRunEvent", () => {
  it("folds console and status events into a run result", () => {
    let result = createInitialServerRunResult();
    result = appendRunEvent(result, RUN_EVENTS.log("linha 1"), 0);
    result = appendRunEvent(result, RUN_EVENTS.error("deu ruim"), 1);
    result = appendRunEvent(result, RUN_EVENTS.status("failed", 120), 2);

    expect(result.entries.map((entry) => entry.text)).toEqual([
      "linha 1",
      "deu ruim",
    ]);
    expect(result.entries.map((entry) => entry.level)).toEqual([
      "log",
      "error",
    ]);
    expect(new Set(result.entries.map((entry) => entry.id)).size).toBe(2);
    expect(result.status).toBe("failed");
    expect(result.durationMs).toBe(120);
  });
});

describe("createServerWorkspaceController", () => {
  interface FetchCall {
    url: string;
    init: RequestInit;
  }

  let calls: FetchCall[];
  let controller: StudioServerWorkspaceController | null;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    controller = null;
  });

  afterEach(() => {
    controller?.dispose();
    vi.useRealTimers();
  });

  function tokenHeader(init: RequestInit): string | null {
    const headers = new Headers(init.headers);
    return headers.get("X-Studio-Workspace-Token");
  }

  function createFetchStub(
    route: (url: string, init: RequestInit) => Response | Promise<Response>
  ): typeof fetch {
    return ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const effective = init ?? {};
      calls.push({ url, init: effective });
      return Promise.resolve(route(url, effective));
    }) as typeof fetch;
  }

  function callsTo(fragment: string): FetchCall[] {
    return calls.filter((call) => call.url.includes(fragment));
  }

  const TREE_BODY = {
    entries: [treeEntry("main.py", "file"), treeEntry("README.md", "file")],
  };

  it("keeps the unlock token in memory and sends it on subsequent requests", async () => {
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok-memoria" });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse(TREE_BODY);
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    await controller.loadTree();

    const treeCalls = callsTo("/workspace/tree");
    expect(treeCalls).toHaveLength(1);
    expect(tokenHeader(treeCalls[0].init)).toBe("tok-memoria");
  });

  it("starts a fresh controller without any token", async () => {
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/tree")) return lockedResponse();
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    const pending = controller.loadTree();
    await vi.advanceTimersByTimeAsync(0);

    const treeCalls = callsTo("/workspace/tree");
    expect(treeCalls).toHaveLength(1);
    expect(tokenHeader(treeCalls[0].init)).toBeNull();
    expect(controller.getState().unlockPromptOpen).toBe(true);

    controller.cancelUnlock();
    await pending;
  });

  it("reopens the prompt on 401 locked and replays the pending action after unlock", async () => {
    let treeAttempts = 0;
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok-novo" });
      }
      if (url.includes("/workspace/tree")) {
        treeAttempts += 1;
        return treeAttempts === 1 ? lockedResponse() : jsonResponse(TREE_BODY);
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    const pendingTree = controller.loadTree();
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().unlockPromptOpen).toBe(true);

    const unlocked = await controller.unlock("segredo");
    expect(unlocked).toBe(true);
    await pendingTree;

    const treeCalls = callsTo("/workspace/tree");
    expect(treeCalls).toHaveLength(2);
    expect(tokenHeader(treeCalls[1].init)).toBe("tok-novo");
    expect(controller.getState().unlockPromptOpen).toBe(false);
    expect(
      controller.getState().tree.map((row) => row.entry.path)
    ).toEqual(["main.py", "README.md"]);
  });

  it("keeps the prompt open with an error message when the password is wrong", async () => {
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse(
          {
            error: "Studio workspace password invalid",
            message: "Senha do workspace incorreta.",
            code: "studio_workspace_password_invalid",
          },
          401
        );
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });
    controller.openUnlockPrompt();

    const unlocked = await controller.unlock("errada");

    expect(unlocked).toBe(false);
    expect(controller.getState().unlockPromptOpen).toBe(true);
    expect(controller.getState().unlockError).toBe(
      "Senha do workspace incorreta."
    );
  });

  it("debounces autosave, tracking dirty → saving → saved with the latest content", async () => {
    const fetchImpl = createFetchStub((url, init) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/file") && init.method === "PUT") {
        return jsonResponse({ saved: true });
      }
      if (url.includes("/workspace/file")) {
        return jsonResponse({ content: "print('oi')\n" });
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({
      fetchImpl,
      autosaveDelayMs: 500,
    });

    await controller.unlock("segredo");
    await controller.openFile("main.py");
    expect(controller.getState().saveState).toBe("saved");

    controller.editActiveFile("print('primeira')\n");
    controller.editActiveFile("print('final')\n");
    expect(controller.getState().saveState).toBe("dirty");

    await vi.advanceTimersByTimeAsync(499);
    const putCallsBefore = callsTo("/workspace/file").filter(
      (call) => call.init.method === "PUT"
    );
    expect(putCallsBefore).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    const putCalls = callsTo("/workspace/file").filter(
      (call) => call.init.method === "PUT"
    );
    expect(putCalls).toHaveLength(1);
    expect(JSON.parse(String(putCalls[0].init.body))).toEqual({
      path: "main.py",
      content: "print('final')\n",
    });
    expect(controller.getState().saveState).toBe("saved");
  });

  it("streams SSE run events into the live console and reloads the tree afterwards", async () => {
    const firstFrame = frame(RUN_EVENTS.log("passo 1"));
    const secondFrame = frame(RUN_EVENTS.error("aviso"));
    const statusFrame = frame(RUN_EVENTS.status("completed", 87));
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse(TREE_BODY);
      }
      if (url.includes("/workspace/file")) {
        return jsonResponse({ content: "print('oi')\n" });
      }
      if (url.includes("/workspace/run")) {
        return sseResponse([
          firstFrame + secondFrame.slice(0, 8),
          secondFrame.slice(8),
          statusFrame,
        ]);
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    await controller.loadTree();
    await controller.openFile("main.py");

    const observedEntryCounts: number[] = [];
    const unsubscribe = controller.subscribe(() => {
      const session = controller?.getState().runSession;
      if (session) observedEntryCounts.push(session.result.entries.length);
    });

    await controller.run();
    unsubscribe();

    const state = controller.getState();
    expect(state.running).toBe(false);
    expect(state.runSession?.filePath).toBe("main.py");
    expect(state.runSession?.result.status).toBe("completed");
    expect(state.runSession?.result.durationMs).toBe(87);
    expect(
      state.runSession?.result.entries.map((entry) => entry.text)
    ).toEqual(["passo 1", "aviso"]);
    // Streaming ao vivo: o console cresce em passos, não só no final.
    expect(observedEntryCounts).toContain(1);

    const treeCalls = callsTo("/workspace/tree");
    expect(treeCalls).toHaveLength(2);
  });

  it("sends stdin with a newline to the active run", async () => {
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse(TREE_BODY);
      }
      if (url.includes("/workspace/file")) {
        return jsonResponse({ content: "nome = input()\n" });
      }
      if (url.includes("/workspace/run/stdin")) {
        return jsonResponse({ sent: true });
      }
      if (url.includes("/workspace/run")) {
        return sseResponse([
          frame(RUN_EVENTS.log("qual teu nome?")),
          frame(RUN_EVENTS.status("completed", 40)),
        ]);
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    await controller.loadTree();
    await controller.openFile("main.py");

    const stdinResults: Promise<boolean>[] = [];
    const unsubscribe = controller.subscribe(() => {
      const current = controller?.getState();
      if (current?.running && stdinResults.length === 0) {
        stdinResults.push(controller!.sendStdin("Anders"));
      }
    });

    await controller.run();
    unsubscribe();

    expect(stdinResults).toHaveLength(1);
    expect(await stdinResults[0]).toBe(true);
    const stdinCalls = callsTo("/workspace/run/stdin");
    expect(stdinCalls).toHaveLength(1);
    expect(JSON.parse(String(stdinCalls[0].init.body))).toEqual({
      data: "Anders\n",
    });
  });

  it("persists the unlock token in the provided storage and restores it in a fresh controller", async () => {
    const store = new Map<string, string>();
    const tokenStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok-sessao" });
      }
      if (url.includes("/workspace/tree")) return jsonResponse(TREE_BODY);
      throw new Error(`rota inesperada: ${url}`);
    });

    controller = createServerWorkspaceController({ fetchImpl, tokenStorage });
    await controller.unlock("segredo");
    expect([...store.values()]).toEqual(["tok-sessao"]);
    controller.dispose();

    // Um controller novo (reload da página) reaproveita o token guardado.
    controller = createServerWorkspaceController({ fetchImpl, tokenStorage });
    await controller.loadTree();
    const treeCalls = callsTo("/workspace/tree");
    expect(treeCalls).toHaveLength(1);
    expect(tokenHeader(treeCalls[0].init)).toBe("tok-sessao");
  });

  it("drops the stored token when the server reports it locked", async () => {
    const store = new Map<string, string>([
      ["gaucho-studio:workspace-token:v1", "tok-vencido"],
    ]);
    const tokenStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const fetchImpl = createFetchStub((url) => {
      if (url.includes("/workspace/tree")) return lockedResponse();
      throw new Error(`rota inesperada: ${url}`);
    });

    controller = createServerWorkspaceController({ fetchImpl, tokenStorage });
    const pending = controller.loadTree();
    await vi.advanceTimersByTimeAsync(0);

    expect(store.size).toBe(0);
    expect(controller.getState().unlockPromptOpen).toBe(true);
    controller.cancelUnlock();
    await pending;
  });

  it("creates an empty file, reloads the tree and opens it", async () => {
    const fetchImpl = createFetchStub((url, init) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/file") && init.method === "PUT") {
        return jsonResponse({ saved: true });
      }
      if (url.includes("/workspace/file")) {
        return jsonResponse({ content: "" });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse({
          entries: [...TREE_BODY.entries, treeEntry("novo.py", "file")],
        });
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    const created = await controller.createFile("novo.py");

    expect(created).toBe(true);
    const putCalls = callsTo("/workspace/file").filter(
      (call) => call.init.method === "PUT"
    );
    expect(putCalls).toHaveLength(1);
    expect(JSON.parse(String(putCalls[0].init.body))).toEqual({
      path: "novo.py",
      content: "",
    });
    expect(callsTo("/workspace/tree")).toHaveLength(1);
    expect(controller.getState().activeFilePath).toBe("novo.py");
  });

  it("creates a folder and reloads the tree", async () => {
    const fetchImpl = createFetchStub((url, init) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/folder") && init.method === "POST") {
        return jsonResponse({ created: true });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse({
          entries: [...TREE_BODY.entries, treeEntry("dados", "directory")],
        });
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    const created = await controller.createFolder("dados");

    expect(created).toBe(true);
    const folderCalls = callsTo("/workspace/folder");
    expect(folderCalls).toHaveLength(1);
    expect(JSON.parse(String(folderCalls[0].init.body))).toEqual({
      path: "dados",
    });
    expect(callsTo("/workspace/tree")).toHaveLength(1);
    expect(
      controller.getState().tree.some((row) => row.entry.path === "dados")
    ).toBe(true);
  });

  it("deletes an entry, closing tabs under it and reloading the tree", async () => {
    const fetchImpl = createFetchStub((url, init) => {
      if (url.includes("/workspace/unlock")) {
        return jsonResponse({ token: "tok" });
      }
      if (url.includes("/workspace/file") && init.method === "DELETE") {
        return jsonResponse({ deleted: true });
      }
      if (url.includes("/workspace/file")) {
        return jsonResponse({ content: "x = 1\n" });
      }
      if (url.includes("/workspace/tree")) {
        return jsonResponse(TREE_BODY);
      }
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    await controller.unlock("segredo");
    await controller.openFile("main.py");
    await controller.openFile("utils/helpers.py");
    expect(controller.getState().activeFilePath).toBe("utils/helpers.py");

    const deleted = await controller.deleteEntry("utils");

    expect(deleted).toBe(true);
    const deleteCalls = callsTo("/workspace/file").filter(
      (call) => call.init.method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].url).toContain("path=utils");
    expect(controller.getState().openFilePaths).toEqual(["main.py"]);
    expect(controller.getState().activeFilePath).toBe("main.py");
    expect(callsTo("/workspace/tree")).toHaveLength(1);
  });

  it("refuses stdin when nothing is running", async () => {
    const fetchImpl = createFetchStub((url) => {
      throw new Error(`rota inesperada: ${url}`);
    });
    controller = createServerWorkspaceController({ fetchImpl });

    expect(await controller.sendStdin("nada")).toBe(false);
    expect(callsTo("/workspace/run/stdin")).toHaveLength(0);
  });
});
