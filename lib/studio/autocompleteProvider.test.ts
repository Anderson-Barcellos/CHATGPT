import type { languages } from "monaco-editor";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStudioAutocompleteRequestController,
  registerStudioAutocompleteProvider,
} from "@/lib/studio/autocompleteProvider";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const requestInput = {
  key: "file:///src/index.ts:1:1:16:hash",
  request: {
    filePath: "src/index.ts",
    language: "typescript" as const,
    prefix: "const answer = ",
    suffix: "",
  },
};

function disposable() {
  return { dispose: vi.fn() };
}

interface HarnessOptions {
  value?: string;
  language?: string;
  desktop?: boolean;
  enabled?: boolean;
  focused?: boolean;
  selectionEmpty?: boolean;
}

function createMonacoHarness(options: HarnessOptions = {}) {
  let value = options.value ?? "const answer = ";
  let language = options.language ?? "typescript";
  let desktop = options.desktop ?? true;
  let enabled = options.enabled ?? true;
  let focused = options.focused ?? true;
  let selectionEmpty = options.selectionEmpty ?? true;
  let version = 1;
  let position = { lineNumber: 1, column: value.length + 1 };
  let registeredLanguages: unknown;
  let registeredProvider: languages.InlineCompletionsProvider | null = null;
  let commandHandler: (() => void) | null = null;
  const handlers = new Map<string, () => void>();

  class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  }

  const model = {
    uri: { toString: () => "file:///src/index.ts" },
    getVersionId: () => version,
    getLanguageId: () => language,
    getValue: () => value,
    getOffsetAt: (candidate: { column: number }) => candidate.column - 1,
    getLineContent: () => value,
  };

  const editor = {
    getSelection: () => ({ isEmpty: () => selectionEmpty }),
    hasTextFocus: () => focused,
    getPosition: () => position,
    addCommand: (_keybinding: number, handler: () => void) => {
      commandHandler = handler;
      return "studio.autocomplete.accepted";
    },
    trigger: vi.fn(),
    onDidChangeModelContent: (handler: () => void) => {
      handlers.set("content", handler);
      return disposable();
    },
    onDidChangeCursorPosition: (handler: () => void) => {
      handlers.set("cursor", handler);
      return disposable();
    },
    onDidChangeCursorSelection: (handler: () => void) => {
      handlers.set("selection", handler);
      return disposable();
    },
    onDidChangeModel: (handler: () => void) => {
      handlers.set("model", handler);
      return disposable();
    },
    onDidCompositionStart: (handler: () => void) => {
      handlers.set("compositionStart", handler);
      return disposable();
    },
    onDidCompositionEnd: (handler: () => void) => {
      handlers.set("compositionEnd", handler);
      return disposable();
    },
  };

  const monaco = {
    Range,
    languages: {
      registerInlineCompletionsProvider(
        selector: unknown,
        provider: languages.InlineCompletionsProvider
      ) {
        registeredLanguages = selector;
        registeredProvider = provider;
        return disposable();
      },
    },
  };

  return {
    monaco,
    editor,
    model,
    handlers,
    get provider() {
      if (!registeredProvider) throw new Error("Provider was not registered");
      return registeredProvider;
    },
    get registeredLanguages() {
      return registeredLanguages;
    },
    invokeCommand() {
      if (!commandHandler) throw new Error("Accept command was not registered");
      commandHandler();
    },
    setDesktop(next: boolean) {
      desktop = next;
    },
    isDesktop() {
      return desktop;
    },
    setEnabled(next: boolean) {
      enabled = next;
    },
    isEnabled() {
      return enabled;
    },
    setFocused(next: boolean) {
      focused = next;
    },
    setSelectionEmpty(next: boolean) {
      selectionEmpty = next;
    },
    setLanguage(next: string) {
      language = next;
    },
    setVersion(next: number) {
      version = next;
    },
    setValue(next: string) {
      value = next;
      position = { lineNumber: 1, column: next.length + 1 };
    },
    setPosition(next: { lineNumber: number; column: number }) {
      position = next;
    },
  };
}

const token = {
  onCancellationRequested: () => disposable(),
};

function controlledToken() {
  let cancel: (() => void) | null = null;

  return {
    token: {
      onCancellationRequested(handler: () => void) {
        cancel = handler;
        return disposable();
      },
    },
    cancel() {
      cancel?.();
    },
  };
}

describe("Studio autocomplete request controller", () => {
  it("deduplicates concurrent requests with the same document key", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const controller = createStudioAutocompleteRequestController({ fetchImpl });

    const first = controller.request(requestInput);
    const duplicate = controller.request(requestInput);

    expect(duplicate).toBe(first);
    expect(fetchImpl).toHaveBeenCalledOnce();
    resolveFetch?.(
      Response.json({ completion: "42", finishReason: "stop" })
    );
    await expect(first).resolves.toEqual({
      completion: "42",
      finishReason: "stop",
    });
    await expect(duplicate).resolves.toEqual({
      completion: "42",
      finishReason: "stop",
    });
    controller.dispose();
  });

  it("aborts the previous request and never returns its late result", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    const statuses: string[] = [];
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange: (status) => statuses.push(status),
    });

    const first = controller.request(requestInput);
    const second = controller.request({ ...requestInput, key: "new-key" });

    expect(signals[0]?.aborted).toBe(true);
    resolvers[0]?.(
      Response.json({ completion: "old", finishReason: "stop" })
    );
    resolvers[1]?.(
      Response.json({ completion: "new", finishReason: "stop" })
    );

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual({
      completion: "new",
      finishReason: "stop",
    });
    expect(statuses.at(-1)).toBe("idle");
    controller.dispose();
  });

  it("times out silently and counts the timeout as a failure", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange: (status) => statuses.push(status),
    });

    const result = controller.request(requestInput);
    await vi.advanceTimersByTimeAsync(8_001);

    await expect(result).resolves.toBeNull();
    expect(statuses).toEqual(["requesting", "idle"]);
    controller.dispose();
  });

  it("enters a 30 second cooldown after three failures and recovers", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const expired = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 })
    );
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange: (status) => statuses.push(status),
      onCooldownExpired: expired,
    });

    await controller.request(requestInput);
    await controller.request({ ...requestInput, key: "2" });
    await controller.request({ ...requestInput, key: "3" });

    expect(statuses.at(-1)).toBe("cooldown");
    await controller.request({ ...requestInput, key: "4" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(statuses.at(-1)).toBe("idle");
    expect(expired).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("respects Retry-After immediately", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { "Retry-After": "12" },
      })
    );
    const controller = createStudioAutocompleteRequestController({
      fetchImpl,
      onStatusChange: (status) => statuses.push(status),
    });

    await controller.request(requestInput);
    expect(statuses.at(-1)).toBe("cooldown");
    await vi.advanceTimersByTimeAsync(12_001);
    expect(statuses.at(-1)).toBe("idle");
    controller.dispose();
  });

  it("rejects malformed success payloads without throwing", async () => {
    const controller = createStudioAutocompleteRequestController({
      fetchImpl: vi
        .fn()
        .mockResolvedValue(Response.json({ completion: 42, finishReason: "stop" })),
    });

    await expect(controller.request(requestInput)).resolves.toBeNull();
    controller.dispose();
  });

  it("releases the key when fetch throws synchronously", async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error("synchronous fetch failure");
    });
    const controller = createStudioAutocompleteRequestController({ fetchImpl });

    await expect(controller.request(requestInput)).resolves.toBeNull();
    await expect(controller.request(requestInput)).resolves.toBeNull();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
});

describe("Studio Monaco inline completion provider", () => {
  it("registers native 450ms completions with a zero-width range", async () => {
    const harness = createMonacoHarness();
    const statuses: string[] = [];
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => harness.isEnabled(),
      isDesktop: () => harness.isDesktop(),
      getFilePath: () => "src/index.ts",
      onStatusChange: (status) => statuses.push(status),
      fetchImpl: vi.fn().mockResolvedValue(
        Response.json({ completion: "42", finishReason: "stop" })
      ),
    });

    expect(harness.registeredLanguages).toEqual([
      "typescript",
      "javascript",
      "python",
    ]);
    expect(harness.provider.debounceDelayMs).toBe(450);
    const result = await harness.provider.provideInlineCompletions(
      harness.model as never,
      { lineNumber: 1, column: 16 } as never,
      {} as never,
      token as never
    );

    expect(result).toMatchObject({
      items: [
        {
          insertText: "42",
          range: {
            startLineNumber: 1,
            startColumn: 16,
            endLineNumber: 1,
            endColumn: 16,
          },
          command: { id: "studio.autocomplete.accepted" },
        },
      ],
    });
    expect(statuses).toContain("requesting");
    handle.dispose();
  });

  it("suppresses a response after the model becomes stale", async () => {
    const harness = createMonacoHarness();
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => true,
      getFilePath: () => "src/index.ts",
      fetchImpl,
    });

    const pending = harness.provider.provideInlineCompletions(
      harness.model as never,
      { lineNumber: 1, column: 16 } as never,
      {} as never,
      token as never
    );
    harness.setVersion(2);
    resolveFetch?.(
      Response.json({ completion: "old", finishReason: "stop" })
    );

    await expect(pending).resolves.toEqual({ items: [] });
    handle.dispose();
  });

  it("does not let an old Monaco token cancel a newer request", async () => {
    const harness = createMonacoHarness();
    const signals: AbortSignal[] = [];
    const resolvers: Array<(response: Response) => void> = [];
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    });
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => true,
      getFilePath: () => "src/index.ts",
      fetchImpl,
    });
    const firstToken = controlledToken();
    const secondToken = controlledToken();

    const first = harness.provider.provideInlineCompletions(
      harness.model as never,
      { lineNumber: 1, column: 16 } as never,
      {} as never,
      firstToken.token as never
    );
    harness.setVersion(2);
    const second = harness.provider.provideInlineCompletions(
      harness.model as never,
      { lineNumber: 1, column: 16 } as never,
      {} as never,
      secondToken.token as never
    );

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    firstToken.cancel();
    expect(signals[1]?.aborted).toBe(false);

    resolvers[0]?.(Response.json({ completion: "old", finishReason: "stop" }));
    resolvers[1]?.(Response.json({ completion: "new", finishReason: "stop" }));
    await expect(first).resolves.toEqual({ items: [] });
    await expect(second).resolves.toMatchObject({
      items: [{ insertText: "new" }],
    });
    handle.dispose();
  });

  it.each([
    { language: "json" },
    { desktop: false },
    { enabled: false },
    { focused: false },
    { selectionEmpty: false },
  ])("does not request when ineligible: %o", async (options) => {
    const harness = createMonacoHarness(options);
    const fetchImpl = vi.fn();
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => harness.isEnabled(),
      isDesktop: () => harness.isDesktop(),
      getFilePath: () => "src/index.ts",
      fetchImpl,
    });

    await expect(
      harness.provider.provideInlineCompletions(
        harness.model as never,
        { lineNumber: 1, column: 16 } as never,
        {} as never,
        token as never
      )
    ).resolves.toEqual({ items: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    handle.dispose();
  });

  it("does not request during IME composition", async () => {
    const harness = createMonacoHarness();
    const fetchImpl = vi.fn();
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => true,
      getFilePath: () => "src/index.ts",
      fetchImpl,
    });

    harness.handlers.get("compositionStart")?.();
    await expect(
      harness.provider.provideInlineCompletions(
        harness.model as never,
        { lineNumber: 1, column: 16 } as never,
        {} as never,
        token as never
      )
    ).resolves.toEqual({ items: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    harness.handlers.get("compositionEnd")?.();
    handle.dispose();
  });

  it("cancels and hides ghost text immediately when disabled", () => {
    const harness = createMonacoHarness();
    const statuses: string[] = [];
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => harness.isEnabled(),
      isDesktop: () => true,
      getFilePath: () => "src/index.ts",
      onStatusChange: (status) => statuses.push(status),
      fetchImpl: vi.fn(),
    });

    harness.setEnabled(false);
    handle.setEnabled(false);

    expect(statuses.at(-1)).toBe("off");
    expect(harness.editor.trigger).toHaveBeenCalledWith(
      "studio.autocomplete",
      "editor.action.inlineSuggest.hide",
      null
    );
    handle.dispose();
  });

  it("triggers one chained evaluation 450ms after acceptance", async () => {
    vi.useFakeTimers();
    const harness = createMonacoHarness();
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => true,
      getFilePath: () => "src/index.ts",
      fetchImpl: vi.fn(),
    });

    harness.invokeCommand();
    await vi.advanceTimersByTimeAsync(449);
    expect(harness.editor.trigger).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(harness.editor.trigger).toHaveBeenCalledTimes(1);
    expect(harness.editor.trigger).toHaveBeenCalledWith(
      "studio.autocomplete",
      "editor.action.inlineSuggest.trigger",
      null
    );
    handle.dispose();
  });

  it.each(["content", "cursor", "selection", "model"])(
    "cancels the accepted-chain timer after a %s interaction",
    async (event) => {
      vi.useFakeTimers();
      const harness = createMonacoHarness();
      const handle = registerStudioAutocompleteProvider({
        monaco: harness.monaco as never,
        editor: harness.editor as never,
        isEnabled: () => true,
        isDesktop: () => true,
        getFilePath: () => "src/index.ts",
        fetchImpl: vi.fn(),
      });

      harness.invokeCommand();
      harness.handlers.get(event)?.();
      await vi.advanceTimersByTimeAsync(450);

      expect(harness.editor.trigger).not.toHaveBeenCalled();
      handle.dispose();
    }
  );

  it("hides completions when the desktop capability disappears", () => {
    const harness = createMonacoHarness();
    const statuses: string[] = [];
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => harness.isDesktop(),
      getFilePath: () => "src/index.ts",
      onStatusChange: (status) => statuses.push(status),
      fetchImpl: vi.fn(),
    });

    harness.setDesktop(false);
    handle.setEnabled(true);

    expect(statuses.at(-1)).toBe("off");
    expect(harness.editor.trigger).toHaveBeenCalledWith(
      "studio.autocomplete",
      "editor.action.inlineSuggest.hide",
      null
    );
    handle.dispose();
  });

  it("suppresses a response when desktop capability is lost in flight", async () => {
    const harness = createMonacoHarness();
    let resolveFetch: ((response: Response) => void) | undefined;
    const handle = registerStudioAutocompleteProvider({
      monaco: harness.monaco as never,
      editor: harness.editor as never,
      isEnabled: () => true,
      isDesktop: () => harness.isDesktop(),
      getFilePath: () => "src/index.ts",
      fetchImpl: vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      ),
    });

    const pending = harness.provider.provideInlineCompletions(
      harness.model as never,
      { lineNumber: 1, column: 16 } as never,
      {} as never,
      token as never
    );
    harness.setDesktop(false);
    resolveFetch?.(
      Response.json({ completion: "late", finishReason: "stop" })
    );

    await expect(pending).resolves.toEqual({ items: [] });
    handle.dispose();
  });
});
