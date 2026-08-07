import { stat } from "node:fs/promises";
import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import {
  STUDIO_WORKSPACE_ACTIVE_DIR,
  resolveWorkspacePath,
} from "@/lib/server/studioWorkspaceFs";
import {
  getConfiguredRunTimeoutMs,
  studioWorkspaceRunner,
} from "@/lib/server/studioWorkspaceRunner";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

const BODY_LIMIT_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const body = await readJsonWithLimit<unknown>(request, {
    limitBytes: BODY_LIMIT_BYTES,
  });
  if (!body.ok) {
    return jsonError(body.status, "Request body error", {
      message: "Corpo da execução inválido.",
      code: "studio_workspace_body_invalid",
    });
  }

  const filePath =
    body.value && typeof body.value === "object" && !Array.isArray(body.value)
      ? (body.value as { filePath?: unknown }).filePath
      : undefined;
  if (typeof filePath !== "string") {
    return jsonError(400, "Request body error", {
      message: "Execução exige filePath.",
      code: "studio_workspace_body_invalid",
    });
  }

  const resolved = await resolveWorkspacePath(
    STUDIO_WORKSPACE_ACTIVE_DIR,
    filePath
  );
  if (!resolved.ok) {
    return jsonError(400, "Invalid run path", {
      message: "Caminho inválido no workspace.",
      code: "studio_workspace_invalid_path",
    });
  }

  try {
    const info = await stat(resolved.absolutePath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return jsonError(404, "Run target not found", {
      message: "Arquivo de execução não encontrado no workspace.",
      code: "studio_workspace_not_found",
    });
  }

  const started = studioWorkspaceRunner.startRun({
    filePath,
    timeoutMs: getConfiguredRunTimeoutMs(),
  });
  if (!started.ok) {
    return jsonError(409, "Run busy", {
      message: "Já existe uma execução em andamento. Use Stop antes.",
      code: "studio_workspace_run_busy",
    });
  }

  // Aba fechada ou request abortado: execução sem observador não tem valor.
  request.signal.addEventListener("abort", () => {
    void studioWorkspaceRunner.stop();
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of started.events) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Stream já encerrado pelo cliente.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
