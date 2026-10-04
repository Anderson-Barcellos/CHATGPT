import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { saveTopics } from "@/lib/discover/store";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonWithLimit<{ topics?: unknown }>(request, { limitBytes: 4096 });
  if (!body.ok) return jsonError(body.status, "Invalid discover topics", { message: "Lista de assuntos inválida.", code: "discover_topics_invalid" });
  try {
    return NextResponse.json({ topics: await saveTopics(body.value?.topics) });
  } catch (error) {
    return jsonError(400, "Invalid discover topics", { message: error instanceof Error ? error.message : "Assuntos inválidos.", code: "discover_topics_invalid" });
  }
}
