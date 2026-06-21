import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { createPulseTask, listPulseTasks } from "@/lib/pulse/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const tasks = await listPulseTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 128 * 1024,
  });
  if (!body.ok) {
    return jsonError(body.status, "Invalid pulse task payload", {
      message:
        body.reason === "too_large"
          ? "Rotina Pulse grande demais."
          : "JSON invalido para rotina Pulse.",
      code: `pulse_task_${body.reason}`,
    });
  }

  try {
    const task = await createPulseTask(body.value);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(400, "Invalid pulse task", {
      message: error instanceof Error ? error.message : "Rotina Pulse invalida.",
      code: "pulse_task_invalid",
    });
  }
}
