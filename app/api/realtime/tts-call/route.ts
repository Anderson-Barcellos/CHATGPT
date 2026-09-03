import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import {
  buildRealtimeCallMultipartBody as buildSharedMultipart,
  buildRealtimeSession,
  createRealtimeCallResponse,
  readRealtimeSdp,
  RealtimeSdpError,
} from "@/lib/server/realtimeCall";

export const runtime = "nodejs";
const MAX_SDP_BYTES = 256 * 1024;

export function buildRealtimeTtsSessionConfig(voice: unknown) {
  return buildRealtimeSession({ product: "chat", voice });
}

export function buildRealtimeCallMultipartBody(sdp: string, voice: unknown) {
  return buildSharedMultipart(sdp, buildRealtimeTtsSessionConfig(voice));
}

export async function POST(request: NextRequest) {
  const diagnosticId = crypto.randomUUID();
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return Response.json(
        { error: "Unauthorized", message: "Faça login para continuar." },
        { status: 401 }
      );
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return Response.json({ error: "OPENAI_API_KEY não configurada." }, { status: 500 });
    }
    return createRealtimeCallResponse({
      request,
      sdp: await readRealtimeSdp(request, MAX_SDP_BYTES),
      session: buildRealtimeTtsSessionConfig(request.nextUrl.searchParams.get("voice")),
      safetyIdentifier: "gaucho-chat-tts-lab",
    });
  } catch (error) {
    if (error instanceof RealtimeSdpError) {
      return Response.json({ error: "SDP muito grande." }, { status: 413 });
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "Sessão Realtime interrompida.", diagnosticId }, { status: 499 });
    }
    console.error("Realtime TTS request error", { diagnosticId });
    return Response.json({ error: "Falha interna ao iniciar Realtime TTS.", diagnosticId }, { status: 500 });
  }
}
