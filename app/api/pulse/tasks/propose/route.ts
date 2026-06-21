import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { PulseTaskExtractionError, extractPulseTaskFromText } from "@/lib/pulse/extractTask";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<Record<string, unknown>>(request, {
    limitBytes: 128 * 1024,
  });
  if (!body.ok) {
    return jsonError(body.status, "Invalid pulse proposal payload", {
      message:
        body.reason === "too_large"
          ? "Texto da rotina ficou grande demais."
          : "JSON invalido para propor rotina Pulse.",
      code: `pulse_task_proposal_${body.reason}`,
    });
  }

  try {
    const proposal = await extractPulseTaskFromText(body.value);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (error instanceof PulseTaskExtractionError) {
      return jsonError(error.status, "Pulse task extraction failed", {
        message:
          error.missingFields.length > 0
            ? `${error.message} Campos faltantes: ${error.missingFields.join(", ")}.`
            : error.message,
        code: error.code,
      });
    }

    if (error instanceof OpenAI.APIError) {
      return jsonError(error.status || 500, error.message, {
        code: error.code ?? "openai_api_error",
      });
    }

    console.error("[pulse] propose error", error);
    return jsonError(500, "Failed to propose pulse task", {
      message: "Nao consegui interpretar essa rotina Pulse agora.",
      code: "pulse_task_proposal_failed",
    });
  }
}
