import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { nextDiscoverScheduledAt } from "@/lib/discover/schedule";
import { readDiscoverState, saveDiscoverSchedule } from "@/lib/discover/store";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonWithLimit<{ enabled?: unknown }>(request, { limitBytes: 1024 });
  if (!body.ok) {
    return jsonError(body.status, "Invalid discover schedule", {
      message: "Agendamento inválido.",
      code: "discover_schedule_invalid",
    });
  }
  if (typeof body.value?.enabled !== "boolean") {
    return jsonError(400, "Invalid discover schedule", {
      message: "Agendamento inválido.",
      code: "discover_schedule_invalid",
    });
  }

  try {
    const schedule = await saveDiscoverSchedule(body.value.enabled);
    const state = await readDiscoverState();
    return NextResponse.json({
      schedule,
      nextScheduledAt: nextDiscoverScheduledAt(schedule, state.lastDailyDate),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[discover] Falha ao atualizar o agendamento.");
    return jsonError(500, "Discover schedule update failed", {
      message: "Não foi possível atualizar o agendamento. Tente novamente.",
      code: "discover_schedule_update_failed",
    });
  }
}
