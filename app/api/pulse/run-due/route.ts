import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { runDuePulseTasks } from "@/lib/pulse/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sem fallback por hostname: atrás do Apache o Next monta nextUrl com o
// próprio host de escuta, então toda requisição parecia "localhost".
function isAuthorizedRunner(request: NextRequest, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const configuredToken = process.env.PULSE_RUNNER_TOKEN?.trim();
  if (!configuredToken) {
    return jsonError(503, "Pulse runner unavailable", {
      message: "PULSE_RUNNER_TOKEN nao configurado.",
      code: "pulse_runner_unconfigured",
    });
  }

  if (!isAuthorizedRunner(request, configuredToken)) {
    return jsonError(401, "Unauthorized", {
      message: "Runner Pulse nao autorizado.",
      code: "pulse_runner_unauthorized",
    });
  }

  try {
    const result = await runDuePulseTasks();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[pulse] run due error", error);
    return jsonError(500, "Pulse runner failed", {
      message:
        error instanceof Error ? error.message : "Falha ao rodar rotinas Pulse.",
      code: "pulse_runner_failed",
    });
  }
}
