import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { deletePulseRun } from "@/lib/pulse/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!id) {
    return jsonError(400, "Pulse run id required", {
      message: "ID da geracao Pulse e obrigatorio.",
      code: "pulse_run_id_required",
    });
  }

  const deleted = await deletePulseRun(id);
  if (!deleted) {
    return jsonError(404, "Pulse run not found", {
      message: "Geracao Pulse nao encontrada.",
      code: "pulse_run_not_found",
    });
  }

  return NextResponse.json({ ok: true });
}
