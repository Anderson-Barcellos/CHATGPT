import { normalizeRealtimeTtsVoice } from "@/lib/tts/speechText";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const REALTIME_MODEL = "gpt-realtime-2.1-mini";
const MAX_UPSTREAM_ERROR_LOG_CHARS = 2_500;

const CHAT_STYLE_INSTRUCTIONS = [
  "You are a text-to-speech renderer for Codex in Gaucho Chat.",
  "When asked to read text aloud, speak only the provided text, without summaries, preambles, or commentary.",
  "Use a warm, attentive Codex-like presence: calm, clear, curious, and gently companionable.",
  "Add a very subtle southern Brazilian gaucho cadence in rhythm and intonation only.",
  "Use a smooth, natural, continuous speaking pace with a steady rhythm and short, context-appropriate pauses at sentence and paragraph boundaries.",
  "Keep the delivery fluid and clear without sounding rushed, choppy, theatrical, or overly slow.",
  "Do not change, shorten, or paraphrase the text to alter pacing.",
  "Do not add regional slang, jokes, interjections, or extra words unless they are already present in the text.",
].join(" ");

export interface RealtimeSessionInput {
  product: "chat" | "soundcase";
  voice: unknown;
  speed?: number;
  instructions?: string;
}

export function buildRealtimeSession(input: RealtimeSessionInput) {
  const instructions = input.product === "chat"
    ? CHAT_STYLE_INSTRUCTIONS
    : [
        "You are the realtime narration renderer for SoundCase.",
        input.instructions?.trim(),
        "Speak only the exact text supplied in each response.create event. Never summarize, translate, introduce, conclude, omit, correct, or add words.",
      ].filter(Boolean).join("\n\n");
  const output = {
    voice: normalizeRealtimeTtsVoice(input.voice),
    ...(input.product === "soundcase" && typeof input.speed === "number"
      ? { speed: Math.min(1.5, Math.max(0.25, input.speed)) }
      : {}),
  };
  return {
    type: "realtime",
    model: REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: { output },
    instructions,
  };
}

export function buildRealtimeCallMultipartBody(sdp: string, session: object) {
  const boundary = `gaucho-realtime-${crypto.randomUUID()}`;
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="sdp"',
    "Content-Type: application/sdp", "", sdp,
    `--${boundary}`,
    'Content-Disposition: form-data; name="session"',
    "Content-Type: application/json", "", JSON.stringify(session),
    `--${boundary}--`, "",
  ].join("\r\n");
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function normalizeUpstreamErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message?.trim()) return parsed.error.message.trim();
  } catch {}
  return raw.trim() || "Falha ao iniciar sessão Realtime.";
}

export async function createRealtimeCallResponse(input: {
  request: Request;
  sdp: string;
  session: object;
  safetyIdentifier: string;
}): Promise<Response> {
  const diagnosticId = crypto.randomUUID();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "OPENAI_API_KEY não configurada." }, { status: 500 });
  if (!input.sdp.trim()) return Response.json({ error: "SDP obrigatório para iniciar Realtime." }, { status: 400 });
  const multipart = buildRealtimeCallMultipartBody(input.sdp, input.session);
  try {
    const upstream = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": input.safetyIdentifier,
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
      signal: input.request.signal,
    });
    const answerSdp = await upstream.text();
    if (!upstream.ok) {
      const openaiRequestId = upstream.headers.get("x-request-id");
      const message = normalizeUpstreamErrorMessage(answerSdp);
      console.error("Realtime TTS upstream error", {
        diagnosticId, status: upstream.status, openaiRequestId,
        message: message.slice(0, MAX_UPSTREAM_ERROR_LOG_CHARS),
      });
      return Response.json({
        error: message, diagnosticId, upstreamStatus: upstream.status, openaiRequestId,
      }, { status: upstream.status });
    }
    return new Response(answerSdp, { status: upstream.status, headers: {
      "Content-Type": "application/sdp", "Cache-Control": "no-store",
    } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "Sessão Realtime interrompida.", diagnosticId }, { status: 499 });
    }
    console.error("Realtime TTS call error", { diagnosticId });
    return Response.json({ error: "Falha interna ao iniciar Realtime TTS.", diagnosticId }, { status: 500 });
  }
}
