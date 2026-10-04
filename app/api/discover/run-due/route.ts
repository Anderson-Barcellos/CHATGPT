import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { runDiscover } from "@/lib/discover/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.DISCOVER_RUNNER_TOKEN?.trim();
  if (!expected) return jsonError(503, "Discover runner unavailable", { message: "Agendador não configurado.", code: "discover_runner_unconfigured" });
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (!left.length || left.length !== right.length || !timingSafeEqual(left, right))
    return jsonError(401, "Unauthorized", { message: "Agendador não autorizado.", code: "discover_runner_unauthorized" });
  return NextResponse.json({ status: await runDiscover("daily") });
}
