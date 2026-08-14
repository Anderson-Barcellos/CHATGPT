import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { studioTerminal } from "@/lib/server/studioTerminal";
import { requireStudioWorkspaceAccess } from "@/lib/server/studioWorkspaceAuth";

export const dynamic = "force-dynamic";

function parseDimension(raw: string | null, fallback: number): number {
  const parsed = parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 2 || parsed > 500) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const gate = await requireStudioWorkspaceAccess(request);
  if (!gate.ok) return gate.response;

  const cols = parseDimension(request.nextUrl.searchParams.get("cols"), 80);
  const rows = parseDimension(request.nextUrl.searchParams.get("rows"), 24);

  const opened = studioTerminal.openStream({ cols, rows });
  if (!opened.ok) {
    if (opened.reason === "stream_busy") {
      return jsonError(409, "Terminal stream busy", {
        message: "O terminal já está aberto em outra aba.",
        code: "studio_terminal_stream_busy",
      });
    }
    return jsonError(500, "Terminal spawn failed", {
      message: "Falha ao iniciar o terminal no servidor.",
      code: "studio_terminal_spawn_failed",
    });
  }

  // Aba fechada ou SSE abortado: a sessão segue viva (idle-kill cuida dela);
  // apenas soltamos o stream para permitir reanexo.
  request.signal.addEventListener("abort", () => {
    studioTerminal.detachStream();
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
