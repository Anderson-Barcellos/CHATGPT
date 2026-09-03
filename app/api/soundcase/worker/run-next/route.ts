import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runNextSoundCaseJob } from "@/lib/server/soundcase/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const token = process.env.SOUNDCASE_WORKER_TOKEN?.trim();
  if (!token) return Response.json({ error: "SoundCase worker unavailable", code: "soundcase_worker_unconfigured" }, { status: 503 });
  if (!authorized(request, token)) return Response.json({ error: "Unauthorized", code: "soundcase_worker_unauthorized" }, { status: 401 });
  try {
    const result = await runNextSoundCaseJob({ workerId: `http-${process.pid}-${crypto.randomUUID()}` });
    return result.status === "empty" ? new Response(null, { status: 204 }) : NextResponse.json(result);
  } catch {
    const diagnosticId = crypto.randomUUID();
    console.error("[soundcase-worker] run failed", { diagnosticId });
    return Response.json({
      error: "SoundCase worker failed",
      code: "soundcase_worker_failed",
      diagnosticId,
    }, { status: 500 });
  }
}
