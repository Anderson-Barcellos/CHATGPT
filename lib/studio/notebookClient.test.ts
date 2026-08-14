import { describe, expect, it, vi } from "vitest";
import type { StudioNotebookEvent } from "@/lib/studio/workspaceServerProtocol";
import {
  createNotebookClientController,
  createNotebookEventParser,
} from "./notebookClient";

function sseFrame(event: StudioNotebookEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

interface StreamHandle {
  emit(chunk: string): void;
  end(): void;
}

function createFetchFake() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let streamHandle: StreamHandle | null = null;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.includes("/notebook/stream")) {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });
      const encoder = new TextEncoder();
      streamHandle = {
        emit(chunk) {
          controller.enqueue(encoder.encode(chunk));
        },
        end() {
          try {
            controller.close();
          } catch {
            // já fechado
          }
        },
      };
      return new Response(body, { status: 200 });
    }

    return Response.json({ sent: true });
  };

  return {
    fetchImpl,
    calls,
    stream: () => {
      if (!streamHandle) throw new Error("stream não aberto");
      return streamHandle;
    },
  };
}

async function flushMicrotasks(times = 5): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

describe("createNotebookEventParser", () => {
  it("parseia frames SSE inteiros e tolera fragmentação e lixo", () => {
    const parser = createNotebookEventParser();
    const event: StudioNotebookEvent = {
      type: "kernel_status",
      status: "idle",
    };
    const frame = sseFrame(event);

    expect(parser.push(frame.slice(0, 10))).toEqual([]);
    expect(parser.push(frame.slice(10))).toEqual([event]);
    expect(parser.push("data: {quebrado\n\n")).toEqual([]);
  });
});

describe("createNotebookClientController", () => {
  it("conecta com token, repassa eventos e acompanha o status do kernel", async () => {
    const fake = createFetchFake();
    const received: StudioNotebookEvent[] = [];
    const controller = createNotebookClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => "tok-123",
    });

    controller.connect({ onEvent: (event) => received.push(event) });
    await flushMicrotasks();

    const headers = new Headers(fake.calls[0]?.init?.headers);
    expect(headers.get("X-Studio-Workspace-Token")).toBe("tok-123");

    fake.stream().emit(sseFrame({ type: "kernel_status", status: "starting" }));
    fake.stream().emit(sseFrame({ type: "kernel_status", status: "idle" }));
    await flushMicrotasks();

    expect(controller.getState().status).toBe("open");
    expect(controller.getState().kernelStatus).toBe("idle");
    expect(received).toHaveLength(2);
  });

  it("kernel_exit fecha o stream com a razão", async () => {
    const fake = createFetchFake();
    const controller = createNotebookClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ onEvent: () => undefined });
    await flushMicrotasks();

    fake.stream().emit(sseFrame({ type: "kernel_exit", reason: "idle" }));
    fake.stream().end();
    await flushMicrotasks();

    expect(controller.getState().status).toBe("closed");
    expect(controller.getState().exitReason).toBe("idle");
  });

  it("stream derrubado sem kernel_exit vira erro", async () => {
    const fake = createFetchFake();
    const controller = createNotebookClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ onEvent: () => undefined });
    await flushMicrotasks();

    fake.stream().end();
    await flushMicrotasks();

    expect(controller.getState().status).toBe("error");
    expect(controller.getState().error).toMatch(/perdida/);
  });

  it("recusa de stream (409) vira mensagem amigável do servidor", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        { message: "O notebook já está aberto em outra aba." },
        { status: 409 }
      );
    const controller = createNotebookClientController({
      fetchImpl,
      tokenProvider: () => null,
    });
    controller.connect({ onEvent: () => undefined });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushMicrotasks();

    expect(controller.getState().status).toBe("error");
    expect(controller.getState().error).toBe(
      "O notebook já está aberto em outra aba."
    );
  });

  it("execute e shutdown fazem POST nas rotas do notebook", async () => {
    const fake = createFetchFake();
    const controller = createNotebookClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => "tok",
    });
    controller.connect({ onEvent: () => undefined });
    await flushMicrotasks();
    fake.stream().emit(sseFrame({ type: "kernel_status", status: "idle" }));
    await flushMicrotasks();

    await controller.execute("cell-1", "print(1)");
    await controller.shutdown();

    const executeCall = fake.calls.find(({ url }) => url.includes("/execute"));
    expect(executeCall).toBeDefined();
    expect(JSON.parse(String(executeCall?.init?.body))).toEqual({
      cellId: "cell-1",
      code: "print(1)",
    });
    expect(
      fake.calls.some(({ url }) => url.includes("/notebook/shutdown"))
    ).toBe(true);
  });

  it("dispose aborta a conexão sem virar erro", async () => {
    const fake = createFetchFake();
    const controller = createNotebookClientController({
      fetchImpl: fake.fetchImpl,
      tokenProvider: () => null,
    });
    const spy = vi.fn();
    controller.subscribe(spy);
    controller.connect({ onEvent: () => undefined });
    await flushMicrotasks();

    controller.dispose();
    await flushMicrotasks();

    expect(controller.getState().status).not.toBe("error");
  });
});
