import type {
  StudioConsoleEntry,
  StudioConsoleLevel,
  StudioRunResult,
} from "@/lib/studio/types";
import {
  createStudioWorkerUsage,
  parseStudioWorkerEvent,
  STUDIO_WORKER_MAX_MESSAGES,
  validateStudioModuleSource,
} from "@/lib/studio/runnerProtocol";
import { apiUrl } from "@/lib/utils";

const RUN_TIMEOUT_MS = 5_000;

interface StudioRunnerOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function createEntry(
  level: StudioConsoleLevel,
  text: string
): StudioConsoleEntry {
  return {
    id: crypto.randomUUID(),
    level,
    text,
  };
}

export function runCompiledStudioModule(
  code: string,
  { timeoutMs = RUN_TIMEOUT_MS, signal }: StudioRunnerOptions = {}
): Promise<StudioRunResult> {
  const unsupportedReason = validateStudioModuleSource(code);
  if (unsupportedReason) {
    return Promise.resolve({
      status: "failed",
      durationMs: 0,
      entries: [createEntry("error", unsupportedReason)],
    });
  }

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve({
      status: "failed",
      durationMs: 0,
      entries: [createEntry("error", "Runner indisponível neste navegador.")],
    });
  }

  if (signal?.aborted) {
    return Promise.resolve({ status: "aborted", durationMs: 0, entries: [] });
  }

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const entries: StudioConsoleEntry[] = [];
    const worker = new Worker(apiUrl("/api/studio/runner"), {
      type: "module",
      name: "gaucho-studio-runner",
    });
    const token = crypto.randomUUID();
    let usage = createStudioWorkerUsage();
    let rejectedMessages = 0;
    let settled = false;

    const finish = (status: StudioRunResult["status"]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
      resolve({
        status,
        durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
        entries,
      });
    };

    const timeout = window.setTimeout(() => {
      entries.push(
        createEntry("error", `Execução interrompida após ${timeoutMs} ms.`)
      );
      finish("timeout");
    }, timeoutMs);

    const handleAbort = () => finish("aborted");
    signal?.addEventListener("abort", handleAbort, { once: true });

    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const parsed = parseStudioWorkerEvent(event.data, token, usage);
      if (!parsed.ok) {
        rejectedMessages += 1;
        if (
          parsed.reason === "message_budget" ||
          parsed.reason === "text_budget" ||
          rejectedMessages > STUDIO_WORKER_MAX_MESSAGES
        ) {
          entries.push(
            createEntry("error", "Limite de saída do runner excedido.")
          );
          finish("failed");
        }
        return;
      }

      usage = parsed.usage;
      const payload = parsed.event;
      if (payload.type === "console") {
        entries.push(createEntry(payload.level, payload.text));
        return;
      }

      if (payload.type === "runtime-error") {
        entries.push(createEntry("error", payload.text));
        finish("failed");
        return;
      }

      finish("completed");
    });

    worker.addEventListener("error", (event) => {
      entries.push(createEntry("error", event.message || "Falha no runner local."));
      finish("failed");
    });

    worker.postMessage({ token, code });
  });
}
