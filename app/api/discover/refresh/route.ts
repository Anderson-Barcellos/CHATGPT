import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { runDiscover } from "@/lib/discover/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const status = await runDiscover("manual");
  return NextResponse.json({ status }, { status: status === "started" ? 202 : 200 });
}
