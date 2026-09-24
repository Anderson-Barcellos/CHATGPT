import { NextRequest } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { TTS_SAFE_INPUT_LIMIT } from "@/lib/tts/speechText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const XAI_TTS_TIMEOUT_MS = 45_000;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const key = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (!key) return Response.json({ error: "A voz da xAI não está configurada neste ambiente." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const text = typeof input.input === "string" ? input.input.trim() : "";
  if (!text) return Response.json({ error: "Texto obrigatório para gerar voz." }, { status: 400 });
  if (text.length > TTS_SAFE_INPUT_LIMIT + 200) return Response.json({ error: "Trecho grande demais para TTS." }, { status: 413 });
  const speed = input.speed === undefined ? 1 : input.speed;
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.7 || speed > 1.5) {
    return Response.json({ error: "Velocidade de voz inválida." }, { status: 400 });
  }

  const diagnosticId = crypto.randomUUID();
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(XAI_TTS_TIMEOUT_MS)]);
    const response = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice_id: "orion",
        language: "pt-BR",
        speed,
        output_format: { codec: "mp3", sample_rate: 24_000, bit_rate: 128_000 },
      }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      console.error("xAI TTS rejected", { diagnosticId, status: response.status });
      return Response.json({ error: "A voz da xAI recusou a geração. Tente novamente.", diagnosticId }, { status: 502 });
    }
    const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!response.body || (!contentType.startsWith("audio/mpeg") && !contentType.startsWith("application/octet-stream"))) {
      console.error("xAI TTS returned unexpected media", { diagnosticId, contentType });
      return Response.json({ error: "A xAI não retornou áudio MP3 válido.", diagnosticId }, { status: 502 });
    }
    return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (request.signal.aborted) return Response.json({ error: "Geração de voz interrompida." }, { status: 499 });
    console.error("xAI TTS unavailable", { diagnosticId, name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Não foi possível gerar voz pela xAI.", diagnosticId }, { status: 502 });
  }
}
