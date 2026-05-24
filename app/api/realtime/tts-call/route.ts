import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { normalizeRealtimeTtsVoice } from "@/lib/tts/speechText";

export const runtime = "nodejs";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const REALTIME_TTS_MODEL = "gpt-realtime-mini";

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export function buildRealtimeTtsSessionConfig(voice: unknown) {
  return {
    type: "realtime",
    model: REALTIME_TTS_MODEL,
    output_modalities: ["audio"],
    audio: {
      output: {
        voice: normalizeRealtimeTtsVoice(voice),
      },
    },
    instructions:
      "You are a text-to-speech renderer. When asked to read text aloud, speak only the provided text, without summaries, preambles, or commentary.",
  };
}

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return Response.json(
        { error: "Unauthorized", message: "Faça login para continuar." },
        { status: 401 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return jsonError("OPENAI_API_KEY não configurada.", 500);

    const sdp = (await request.text()).trim();
    if (!sdp) return jsonError("SDP obrigatório para iniciar Realtime.", 400);

    const formData = new FormData();
    formData.set("sdp", sdp);
    formData.set(
      "session",
      JSON.stringify(
        buildRealtimeTtsSessionConfig(request.nextUrl.searchParams.get("voice"))
      )
    );

    const upstream = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": "gaucho-chat-tts-lab",
      },
      body: formData,
      signal: request.signal,
    });

    const answerSdp = await upstream.text();
    if (!upstream.ok) {
      return Response.json(
        { error: answerSdp || "Falha ao iniciar sessão Realtime." },
        { status: upstream.status }
      );
    }

    return new Response(answerSdp, {
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Realtime TTS call error:", error);

    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "Sessão Realtime interrompida." }, { status: 499 });
    }

    return Response.json(
      { error: "Falha interna ao iniciar Realtime TTS." },
      { status: 500 }
    );
  }
}
