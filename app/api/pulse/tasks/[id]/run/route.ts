import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getPulseTask } from "@/lib/pulse/store";
import { runPulseTaskNow } from "@/lib/pulse/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const task = await getPulseTask(id);
  if (!task) {
    return jsonError(404, "Pulse task not found", {
      message: "Rotina Pulse nao encontrada.",
      code: "pulse_task_not_found",
    });
  }

  try {
    const run = await runPulseTaskNow(task);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return jsonError(409, "Pulse run failed", {
      message:
        error instanceof Error ? error.message : "Nao consegui executar essa rotina.",
      code: "pulse_run_failed",
    });
  }
}
