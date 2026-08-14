import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { studioTerminal } from "@/lib/server/studioTerminal";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 1024;

function parseDimension(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 2 || value > 500) return null;
  return value;
}

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo do resize inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const payload =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { cols?: unknown; rows?: unknown })
      : {};
  const cols = parseDimension(payload.cols);
  const rows = parseDimension(payload.rows);
  if (cols === null || rows === null) {
    return jsonError(400, "Request body error", {
      message: "O resize exige cols e rows inteiros entre 2 e 500.",
      code: "studio_workspace_body_invalid",
    });
  }

  const resized = studioTerminal.resize(cols, rows);
  if (!resized) {
    return jsonError(409, "Terminal not active", {
      message: "Não há sessão de terminal ativa.",
      code: "studio_terminal_not_active",
    });
  }

  return Response.json({ resized: true });
}
