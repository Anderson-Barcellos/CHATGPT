import type { NextRequest } from "next/server";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { OpenAILiveSpeechError, readWithOpenAILive } from "@/lib/server/openaiLiveSpeech";
import { normalizeLiveTranscript, normalizeOpenAILiveSettings, OPENAI_LIVE_SPEECH_LIMIT } from "@/lib/tts/openaiLiveSpeech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let activeReads = 0;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const body = await readJsonWithLimit<{ text?: unknown; voice?: unknown; pace?: unknown }>(request, { limitBytes: 4096 });
  if (!body.ok) return Response.json({ error: "Trecho inválido para leitura." }, { status: body.status });
  const text = typeof body.value?.text === "string" ? body.value.text.trim() : "";
  if (text.length > OPENAI_LIVE_SPEECH_LIMIT || !normalizeLiveTranscript(text)) {
    return Response.json({ error: "Trecho inválido para leitura." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "OpenAI Live 1.1 indisponível." }, { status: 503 });
  if (activeReads >= 4) return Response.json({ error: "Há leituras demais em andamento. Tente novamente." }, { status: 429 });
  activeReads += 1;
  try {
    const pcm = await readWithOpenAILive(text, apiKey, request.signal, normalizeOpenAILiveSettings(body.value));
    return new Response(new Uint8Array(pcm), {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof OpenAILiveSpeechError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Falha ao gerar áudio com o Live 1.1." }, { status: 502 });
  } finally {
    activeReads -= 1;
  }
}
