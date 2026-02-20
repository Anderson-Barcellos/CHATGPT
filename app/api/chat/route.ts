import OpenAI from "openai";
import { NextRequest } from "next/server";
import { MODELS, isReasoningModel } from "@/lib/models/modelConfig";

const ALLOWED_MODELS = new Set(Object.keys(MODELS).filter(id => {
  const m = MODELS[id];
  return m.capabilities.includes("chat") || m.capabilities.includes("reasoning");
}));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      input,
      model = "gpt-5.1-chat-latest",
      instructions,
      maxOutputTokens,
      temperature = 0.7,
      topP = 1,
      stream = true,
      reasoning
    } = body;

    if (!input) {
      return Response.json({ error: "Input é obrigatório" }, { status: 400 });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return Response.json({ error: "Modelo não permitido" }, { status: 400 });
    }

    const modelMaxOutput = MODELS[model]?.maxOutput;
    // Se maxOutputTokens não foi fornecido, usa o máximo do modelo (ou um fallback seguro)
    const effectiveMaxTokens = maxOutputTokens ?? modelMaxOutput ?? 4096;
    const clampedMaxTokens = modelMaxOutput
      ? Math.min(effectiveMaxTokens, modelMaxOutput)
      : effectiveMaxTokens;

    // Nunca enviar temperature/topP - deixar OpenAI usar defaults (1.0)
    const reasoningParams = isReasoningModel(model) ? { reasoning } : {};

    if (stream) {
      const streamResponse = await openai.responses.create({
        model,
        instructions,
        input,
        max_output_tokens: clampedMaxTokens,
        tools: [
          { type: "image_generation" },
          {
            type: "web_search_preview",
            search_context_size: "medium",
            user_location: { type: "approximate", country: "BR" },
          },
        ],
        ...reasoningParams,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of streamResponse) {
              const data = JSON.stringify(event);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const response = await openai.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: clampedMaxTokens,
      tools: [
        { type: "image_generation" },
        {
          type: "web_search_preview",
          search_context_size: "medium",
          user_location: { type: "approximate", country: "BR" },
        },
      ],
      ...reasoningParams,
    });

    return Response.json(response);
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof OpenAI.APIError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status || 500 }
      );
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
