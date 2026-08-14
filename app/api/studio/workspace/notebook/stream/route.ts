import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { studioNotebookKernel } from "@/lib/server/studioNotebookKernel";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const opened = studioNotebookKernel.openStream();
  if (!opened.ok) {
    if (opened.reason === "stream_busy") {
      return jsonError(409, "Notebook stream busy", {
        message: "O notebook já está aberto em outra aba.",
        code: "studio_notebook_stream_busy",
      });
    }
    return jsonError(500, "Notebook kernel spawn failed", {
      message: "Falha ao iniciar o kernel do notebook no servidor.",
      code: "studio_notebook_spawn_failed",
    });
  }

  // Aba fechada ou SSE abortado: o kernel segue vivo (idle-kill cuida dele);
  // apenas soltamos o stream para permitir reanexo.
  request.signal.addEventListener("abort", () => {
    studioNotebookKernel.detachStream();
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of opened.events) {
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
