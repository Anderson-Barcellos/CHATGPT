import type { StudioConsoleLevel } from "@/lib/studio/types";

export const STUDIO_WORKER_MAX_MESSAGES = 200;
export const STUDIO_WORKER_MAX_TEXT_BYTES = 64 * 1024;
export const STUDIO_WORKER_MAX_ENTRY_BYTES = 8 * 1024;

export interface StudioWorkerUsage {
  messageCount: number;
  textBytes: number;
}

export type StudioWorkerEvent =
  | {
      token: string;
      type: "console";
      level: StudioConsoleLevel;
      text: string;
    }
  | { token: string; type: "runtime-error"; text: string }
  | { token: string; type: "done" };

type StudioWorkerEventParseResult =
  | { ok: true; event: StudioWorkerEvent; usage: StudioWorkerUsage }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_token"
        | "message_budget"
        | "text_budget";
    };

const CONSOLE_LEVELS = new Set<StudioConsoleLevel>([
  "log",
  "info",
  "warn",
  "error",
]);

export function createStudioWorkerUsage(): StudioWorkerUsage {
  return { messageCount: 0, textBytes: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseStudioWorkerEvent(
  value: unknown,
  token: string,
  usage: StudioWorkerUsage
): StudioWorkerEventParseResult {
  if (!isRecord(value)) return { ok: false, reason: "invalid_payload" };
  if (value.token !== token) return { ok: false, reason: "invalid_token" };
  if (usage.messageCount >= STUDIO_WORKER_MAX_MESSAGES) {
    return { ok: false, reason: "message_budget" };
  }

  if (value.type === "done") {
    return {
      ok: true,
      event: { token, type: "done" },
      usage: { ...usage, messageCount: usage.messageCount + 1 },
    };
  }

  if (value.type !== "console" && value.type !== "runtime-error") {
    return { ok: false, reason: "invalid_payload" };
  }
  if (typeof value.text !== "string") {
    return { ok: false, reason: "invalid_payload" };
  }

  const textBytes = new TextEncoder().encode(value.text).byteLength;
  if (
    textBytes > STUDIO_WORKER_MAX_ENTRY_BYTES ||
    usage.textBytes + textBytes > STUDIO_WORKER_MAX_TEXT_BYTES
  ) {
    return { ok: false, reason: "text_budget" };
  }

  const nextUsage = {
    messageCount: usage.messageCount + 1,
    textBytes: usage.textBytes + textBytes,
  };

  if (value.type === "runtime-error") {
    return {
      ok: true,
      event: { token, type: "runtime-error", text: value.text },
      usage: nextUsage,
    };
  }

  if (
    typeof value.level !== "string" ||
    !CONSOLE_LEVELS.has(value.level as StudioConsoleLevel)
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  return {
    ok: true,
    event: {
      token,
      type: "console",
      level: value.level as StudioConsoleLevel,
      text: value.text,
    },
    usage: nextUsage,
  };
}

export function validateStudioModuleSource(code: string): string | null {
  const relativeStaticImport =
    /(?:^|\n)\s*(?:import|export)\s+[\s\S]*?\sfrom\s*["'][.]{1,2}\//m;
  const relativeDynamicImport = /import\s*\(\s*["'][.]{1,2}\//m;

  if (relativeStaticImport.test(code) || relativeDynamicImport.test(code)) {
    return "O runner v1 executa um arquivo isolado e ainda não resolve imports entre arquivos.";
  }

  return null;
}
