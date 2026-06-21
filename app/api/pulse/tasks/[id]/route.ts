import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { deletePulseTask, updatePulseTaskStatus } from "@/lib/pulse/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!id) {
    return jsonError(400, "Pulse task id required", {
      message: "ID da rotina Pulse e obrigatorio.",
      code: "pulse_task_id_required",
    });
  }

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 16 * 1024,
  });
  if (!body.ok) {
    return jsonError(body.status, "Invalid pulse task update payload", {
      message: "JSON invalido para atualizar rotina Pulse.",
      code: `pulse_task_update_${body.reason}`,
    });
  }

  const status = body.value.status;
  if (status !== "active" && status !== "paused") {
    return jsonError(400, "Invalid pulse task status", {
      message: "Status precisa ser active ou paused.",
      code: "pulse_task_status_invalid",
    });
  }

  const task = await updatePulseTaskStatus(id, status);
  if (!task) {
    return jsonError(404, "Pulse task not found", {
      message: "Rotina Pulse nao encontrada.",
      code: "pulse_task_not_found",
    });
  }

  return NextResponse.json({ task });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const deleted = await deletePulseTask(id);
  if (!deleted) {
    return jsonError(404, "Pulse task not found", {
      message: "Rotina Pulse nao encontrada.",
      code: "pulse_task_not_found",
    });
  }

  return NextResponse.json({ ok: true });
}
