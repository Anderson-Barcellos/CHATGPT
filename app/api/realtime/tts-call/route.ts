import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import {
  buildRealtimeCallMultipartBody as buildSharedMultipart,
  buildRealtimeSession,
  createRealtimeCallResponse,
} from "@/lib/server/realtimeCall";

export const runtime = "nodejs";

export function buildRealtimeTtsSessionConfig(voice: unknown) {
  return buildRealtimeSession({ product: "chat", voice });
}

export function buildRealtimeCallMultipartBody(sdp: string, voice: unknown) {
  return buildSharedMultipart(sdp, buildRealtimeTtsSessionConfig(voice));
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return Response.json(
      { error: "Unauthorized", message: "Faça login para continuar." },
      { status: 401 }
    );
  }
  return createRealtimeCallResponse({
    request,
    sdp: await request.text(),
    session: buildRealtimeTtsSessionConfig(request.nextUrl.searchParams.get("voice")),
    safetyIdentifier: "gaucho-chat-tts-lab",
  });
}
