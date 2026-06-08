import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { normalizeRealtimeTtsVoice } from "@/lib/tts/speechText";

export const runtime = "nodejs";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const REALTIME_TTS_MODEL = "gpt-realtime-mini";
const MAX_UPSTREAM_ERROR_LOG_CHARS = 2500;
const REALTIME_TTS_STYLE_INSTRUCTIONS = [
  "You are a text-to-speech renderer for Codex in Gaucho Chat.",
  "When asked to read text aloud, speak only the provided text, without summaries, preambles, or commentary.",
  "Use a warm, attentive Codex-like presence: calm, clear, curious, and gently companionable.",
  "Add a very subtle southern Brazilian gaucho cadence in rhythm and intonation only.",
  "Do not add regional slang, jokes, interjections, or extra words unless they are already present in the text.",
].join(" ");

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function normalizeUpstreamErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message?.trim()) {
      return parsed.error.message.trim();
    }
  } catch {
    // noop: keep raw fallback
  }

  return raw.trim() || "Falha ao iniciar sessão Realtime.";
}

function clipForLog(value: string, max = MAX_UPSTREAM_ERROR_LOG_CHARS) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
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
    instructions: REALTIME_TTS_STYLE_INSTRUCTIONS,
  };
}

export function buildRealtimeCallMultipartBody(sdp: string, voice: unknown) {
  const boundary = `gaucho-realtime-${crypto.randomUUID()}`;
  const session = JSON.stringify(buildRealtimeTtsSessionConfig(voice));
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="sdp"',
    "Content-Type: application/sdp",
    "",
    sdp,
    `--${boundary}`,
    'Content-Disposition: form-data; name="session"',
    "Content-Type: application/json",
    "",
    session,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return jsonError("OPENAI_API_KEY não configurada.", 500);

    const sdp = await request.text();
    if (!sdp.trim()) return jsonError("SDP obrigatório para iniciar Realtime.", 400);
    const multipart = buildRealtimeCallMultipartBody(
      sdp,
      request.nextUrl.searchParams.get("voice")
    );

    const upstream = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": "gaucho-chat-tts-lab",
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
      signal: request.signal,
    });

    const answerSdp = await upstream.text();
    if (!upstream.ok) {
      const openaiRequestId = upstream.headers.get("x-request-id");
      const message = normalizeUpstreamErrorMessage(answerSdp);

      console.error("Realtime TTS upstream error", {
        diagnosticId,
        status: upstream.status,
        openaiRequestId,
        message,
        body: clipForLog(answerSdp),
      });

      return Response.json(
        {
          error: message,
          diagnosticId,
          upstreamStatus: upstream.status,
          openaiRequestId,
        },
        { status: upstream.status }
      );
    }

    return new Response(answerSdp, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Realtime TTS call error", { diagnosticId, error });

    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json(
        { error: "Sessão Realtime interrompida.", diagnosticId },
        { status: 499 }
      );
    }

    return Response.json(
      { error: "Falha interna ao iniciar Realtime TTS.", diagnosticId },
      { status: 500 }
    );
  }
}
