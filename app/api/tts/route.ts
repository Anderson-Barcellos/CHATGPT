import OpenAI from "openai";
import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import {
  isTtsVoice,
  normalizeTtsPreferences,
  TTS_MODEL,
  TTS_SAFE_INPUT_LIMIT,
} from "@/lib/tts/speechText";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return Response.json(
        { error: "Unauthorized", message: "Faça login para continuar." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return jsonError("Texto obrigatório para gerar voz.", 400);
    if (input.length > TTS_SAFE_INPUT_LIMIT + 200) {
      return jsonError("Trecho grande demais para TTS. Divida a mensagem em partes.", 413);
    }

    if (body.voice !== undefined && !isTtsVoice(body.voice)) {
      return jsonError("Voz de TTS inválida.", 400);
    }

    const preferences = normalizeTtsPreferences({
      voice: body.voice,
      speed: body.speed,
      instructions: body.instructions,
    });

    const speech = await openai.audio.speech.create(
      {
        model: TTS_MODEL,
        voice: preferences.voice,
        input,
        speed: preferences.speed,
        instructions: preferences.instructions.trim() || undefined,
        response_format: "mp3",
      },
      { signal: request.signal }
    );

    if (speech.body) {
      return new Response(speech.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await speech.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);

    if (error instanceof OpenAI.APIError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status || 500 }
      );
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "Geração de voz interrompida." }, { status: 499 });
    }

    return Response.json({ error: "Falha interna ao gerar voz." }, { status: 500 });
  }
}
