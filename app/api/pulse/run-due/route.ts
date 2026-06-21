import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { runDuePulseTasks } from "@/lib/pulse/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedRunner(request: NextRequest): boolean {
  const configuredToken = process.env.PULSE_RUNNER_TOKEN?.trim();
  if (configuredToken) {
    const header = request.headers.get("authorization") ?? "";
    return header === `Bearer ${configuredToken}`;
  }

  const host = request.nextUrl.hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedRunner(request)) {
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
