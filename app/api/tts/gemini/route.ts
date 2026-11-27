import type { NextRequest } from "next/server";
import { GeminiTtsError, synthesizeGeminiTts } from "@/lib/server/geminiTts";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { GEMINI_TTS_REQUEST_TIMEOUT_MS, GEMINI_TTS_TEXT_LIMIT, normalizeGeminiTtsSettings } from "@/lib/tts/geminiTts";
import { sanitizeSpeechText } from "@/lib/tts/speechText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
let activeReads = 0;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonWithLimit<{ text?: unknown }>(request, { limitBytes: 128 * 1024 });
  if (!body.ok) return error("Texto inválido para leitura.", body.status);
  const text = typeof body.value?.text === "string" ? sanitizeSpeechText(body.value.text, { preserveParagraphs: true }) : "";
  if (!text) return error("Informe um texto para gerar o áudio.", 400);
  if (text.length > GEMINI_TTS_TEXT_LIMIT) return error("O Gemini TTS aceita até 20.000 caracteres por leitura.", 400);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return error("Gemini TTS indisponível.", 503);
  if (activeReads >= 4) return error("Há leituras demais em andamento. Tente novamente.", 429);

  activeReads += 1;
  try {
    const wav = await synthesizeGeminiTts(text, apiKey, normalizeGeminiTtsSettings(body.value),
      AbortSignal.any([request.signal, AbortSignal.timeout(GEMINI_TTS_REQUEST_TIMEOUT_MS)]));
    return new Response(wav, { headers: { ...headers, "Content-Type": "audio/wav" } });
  } catch (cause) {
    if (request.signal.aborted) return error("Leitura cancelada.", 499);
    if (cause instanceof GeminiTtsError) return error(cause.message, cause.status);
    if (cause instanceof DOMException && cause.name === "TimeoutError") return error("O Gemini TTS demorou demais para responder.", 504);
    return error("Falha ao gerar áudio com o Gemini TTS.", 502);
  } finally {
    activeReads -= 1;
  }
}
