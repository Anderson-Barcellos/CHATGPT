import OpenAI from "openai";
import { NextRequest } from "next/server";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { validateTranscriptionFile } from "@/lib/server/transcriptionValidation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return Response.json(
        { error: "Unauthorized", message: "Faça login para continuar." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "Arquivo de audio obrigatorio." }, { status: 400 });
    }

    const validation = validateTranscriptionFile(file);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY nao configurada no servidor." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    if (process.env.TRANSCRIPTION_STREAMING_ENABLED !== "false") {
      const upstream = await openai.audio.transcriptions.create(
        {
          file,
          model: "gpt-4o-transcribe",
          stream: true,
        },
        { signal: request.signal }
      );
      const encoder = new TextEncoder();

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of upstream) {
              if (event.type === "transcript.text.delta") {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: "delta", delta: event.delta })}\n`)
                );
              } else if (event.type === "transcript.text.done") {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: "done", text: event.text })}\n`)
                );
              }
            }
          } catch (streamError) {
            if (!request.signal.aborted) {
              const message =
                streamError instanceof Error
                  ? streamError.message
                  : "Falha ao transmitir a transcricao.";
              controller.enqueue(
                encoder.encode(`${JSON.stringify({ type: "error", error: message })}\n`)
              );
            }
          } finally {
            controller.close();
          }
        },
        cancel() {
          upstream.controller.abort();
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-transcribe",
    });

    return Response.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription API error:", error);

    if (error instanceof OpenAI.APIError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status || 500 }
      );
    }

    return Response.json({ error: "Falha interna ao transcrever o audio." }, { status: 500 });
  }
}
