import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TERMINAL_INPUT_FLUSH_MS,
  TERMINAL_RESIZE_DEBOUNCE_MS,
  createTerminalClientController,
  createTerminalEventParser,
} from "@/lib/studio/terminalClient";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
}

function sseFrame(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function createFetchFake() {
  const requests: RecordedRequest[] = [];
  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null;
  let streamResponse: { status: number; body?: unknown } | null = null;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    });

    if (url.includes("/terminal/stream")) {
      if (streamResponse) {
        return new Response(JSON.stringify(streamResponse.body ?? {}), {
          status: streamResponse.status,
        });
      }
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
      });
      return new Response(stream, { status: 200 });
    }
    return Response.json({ sent: true, resized: true, closed: true });
  }) as typeof fetch;

  return {
    requests,
    fetchImpl,
    failNextStream(status: number, body?: unknown) {
      streamResponse = { status, body };
    },
    emit(payload: unknown) {
      streamController?.enqueue(sseFrame(payload));
    },
    endStream() {
      streamController?.close();
    },
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createTerminalEventParser", () => {
  it("parses framed terminal events and ignores garbage", () => {
    const parser = createTerminalEventParser();
    const first = parser.push('data: {"type":"data","data":"olá"}\n\n');
    expect(first).toEqual([{ type: "data", data: "olá" }]);

    expect(parser.push("data: lixo{\n\n")).toEqual([]);

    const split = parser.push('data: {"type":"exit",');
    expect(split).toEqual([]);
    expect(parser.push('"reason":"idle"}\n\n')).toEqual([
      { type: "exit", reason: "idle" },
    ]);
  });
});

describe("createTerminalClientController", () => {
  it("connects with dimensions and token, forwarding data to the sink", async () => {
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => "token-teste",
    });
    const received: string[] = [];
    controller.connect({ cols: 120, rows: 32, onData: (d) => received.push(d) });

    await flushMicrotasks();
    expect(controller.getState().status).toBe("open");
    const streamRequest = fake.requests[0];
    expect(streamRequest.url).toContain("cols=120");
    expect(streamRequest.url).toContain("rows=32");
    expect(streamRequest.headers.get("X-Studio-Workspace-Token")).toBe(
      "token-teste"
    );

    fake.emit({ type: "data", data: "bash-5.2$ " });
    await flushMicrotasks();
    expect(received).toEqual(["bash-5.2$ "]);
  });

  it("reports the exit reason and closes the state", async () => {
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await flushMicrotasks();

    fake.emit({ type: "exit", reason: "idle" });
    fake.endStream();
    await flushMicrotasks();

    const state = controller.getState();
    expect(state.status).toBe("closed");
    expect(state.exitReason).toBe("idle");
  });

  it("treats a dropped stream without exit event as an error", async () => {
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await flushMicrotasks();

    fake.endStream();
    await flushMicrotasks();

    expect(controller.getState().status).toBe("error");
  });

  it("surfaces stream_busy as a friendly error", async () => {
    const fake = createFetchFake();
    fake.failNextStream(409, {
      message: "O terminal já está aberto em outra aba.",
      code: "studio_terminal_stream_busy",
    });
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await flushMicrotasks();

    const state = controller.getState();
    expect(state.status).toBe("error");
    expect(state.error).toContain("já está aberto");
  });

  it("batches rapid keystrokes into a single input POST", async () => {
    vi.useFakeTimers();
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => "tok",
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await vi.advanceTimersByTimeAsync(0);

    controller.sendInput("l");
    controller.sendInput("s");
    controller.sendInput("\r");
    await vi.advanceTimersByTimeAsync(TERMINAL_INPUT_FLUSH_MS + 5);

    const inputPosts = fake.requests.filter((request) =>
      request.url.includes("/terminal/input")
    );
    expect(inputPosts).toHaveLength(1);
    expect(JSON.parse(inputPosts[0].body ?? "{}")).toEqual({ data: "ls\r" });
    expect(inputPosts[0].headers.get("X-Studio-Workspace-Token")).toBe("tok");
  });

  it("debounces resize, sending only the final geometry", async () => {
    vi.useFakeTimers();
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await vi.advanceTimersByTimeAsync(0);

    controller.sendResize(100, 30);
    controller.sendResize(132, 40);
    await vi.advanceTimersByTimeAsync(TERMINAL_RESIZE_DEBOUNCE_MS + 5);

    const resizePosts = fake.requests.filter((request) =>
      request.url.includes("/terminal/resize")
    );
    expect(resizePosts).toHaveLength(1);
    expect(JSON.parse(resizePosts[0].body ?? "{}")).toEqual({
      cols: 132,
      rows: 40,
    });
  });

  it("close posts to the close route and finishes the session", async () => {
    const fake = createFetchFake();
    const controller = createTerminalClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ cols: 80, rows: 24, onData: () => {} });
    await flushMicrotasks();

    await controller.close();
    expect(
      fake.requests.some((request) => request.url.includes("/terminal/close"))
    ).toBe(true);
    expect(controller.getState().status).toBe("closed");
  });
});
