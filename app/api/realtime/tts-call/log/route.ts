import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

const MAX_TEXT = 2000;

type ClientRealtimeLogPayload = {
  level?: "info" | "warn" | "error";
  event?: unknown;
  message?: unknown;
  details?: unknown;
};

function clipText(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function serializeDetails(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "string") {
    return clipText(value);
  }

  try {
    const serialized = JSON.stringify(value);
    return clipText(serialized);
  } catch {
    return clipText(String(value));
  }
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return Response.json(
      { error: "Unauthorized", message: "Faça login para continuar." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as ClientRealtimeLogPayload | null;
  if (!body) {
    return Response.json(
      { error: "Payload JSON inválido para log de Realtime." },
      { status: 400 }
    );
  }

  const event = clipText(body.event) ?? "unknown_event";
  const message = clipText(body.message) ?? "sem mensagem";
  const details = serializeDetails(body.details);
  const level = body.level === "info" || body.level === "error" ? body.level : "warn";

  const logPayload = {
    level,
    event,
    message,
    details,
    userAgent: clipText(request.headers.get("user-agent"), 300),
  };

  if (level === "error") {
    console.error("Realtime TTS client log", logPayload);
  } else {
    console.warn("Realtime TTS client log", logPayload);
  }

  return Response.json({ ok: true });
}
