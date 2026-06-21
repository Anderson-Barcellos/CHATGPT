import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { listPulseRuns } from "@/lib/pulse/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const taskId = request.nextUrl.searchParams.get("taskId") ?? undefined;
  const runs = await listPulseRuns(taskId);
  return NextResponse.json({ runs });
}
