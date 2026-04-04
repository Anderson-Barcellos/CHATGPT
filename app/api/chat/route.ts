import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { ResponseVerbosity } from "@/types";
import {
  MODELS,
  isReasoningModel,
  modelSupportsCodeInterpreter,
  modelSupportsTemperature,
  modelSupportsVerbosity,
} from "@/lib/models/modelConfig";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";

type ChatRequestBody = {
  input?: OpenAI.Responses.ResponseInput;
  model?: string;
  instructions?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  verbosity?: ResponseVerbosity;
  stream?: boolean;
  reasoning?: OpenAI.Responses.ResponseCreateParams["reasoning"];
  codeInterpreterEnabled?: boolean;
};

const ALLOWED_MODELS = new Set(
  Object.keys(MODELS).filter((id) => {
    const model = MODELS[id];
    return model.capabilities.includes("chat") || model.capabilities.includes("reasoning");
  })
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildTools(model: string, codeInterpreterEnabled: boolean) {
  const tools: OpenAI.Responses.Tool[] = [
    { type: "image_generation" },
    {
      type: "web_search_preview",
      search_context_size: "medium",
      user_location: { type: "approximate", country: "BR" },
    },
  ];

  if (codeInterpreterEnabled && modelSupportsCodeInterpreter(model)) {
    tools.push({
      type: "code_interpreter",
      container: { type: "auto" },
    });
  }

  return tools;
}

function buildRequestParams(body: ChatRequestBody) {
  const {
    input,
    model = "gpt-5.3-chat-latest",
    instructions,
    maxOutputTokens,
    temperature,
    topP,
    verbosity,
    reasoning,
    codeInterpreterEnabled = false,
  } = body;

  const modelMaxOutput = MODELS[model]?.maxOutput;
  const effectiveMaxTokens = maxOutputTokens ?? modelMaxOutput ?? 4096;
  const clampedMaxTokens = modelMaxOutput
    ? Math.min(Math.max(Math.round(effectiveMaxTokens), 1), modelMaxOutput)
    : Math.max(Math.round(effectiveMaxTokens), 1);

  const requestParams: Omit<
    OpenAI.Responses.ResponseCreateParamsStreaming,
    "stream"
  > = {
    model,
    instructions,
    input: input!,
    max_output_tokens: clampedMaxTokens,
    tools: buildTools(model, codeInterpreterEnabled),
  };

  if (modelSupportsTemperature(model)) {
    if (temperature !== undefined) {
      requestParams.temperature = temperature;
    }
    if (topP !== undefined) {
      requestParams.top_p = topP;
    }
  }

  if (isReasoningModel(model) && reasoning) {
    requestParams.reasoning = reasoning;
  }

  if (modelSupportsVerbosity(model) && verbosity) {
    requestParams.text = {
      ...requestParams.text,
      verbosity,
    };
  }

  return requestParams;
}

export async function POST(request: NextRequest) {
  try {
    if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Faça login para continuar." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ChatRequestBody;
    const {
      input,
      model = "gpt-5.3-chat-latest",
      stream = true,
    } = body;

    if (!input) {
      return Response.json({ error: "Input é obrigatório" }, { status: 400 });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return Response.json({ error: "Modelo não permitido" }, { status: 400 });
    }

    const requestParams = buildRequestParams(body);

    if (stream) {
      const streamResponse = await openai.responses.create({
        ...requestParams,
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

    const response = await openai.responses.create(requestParams);

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
