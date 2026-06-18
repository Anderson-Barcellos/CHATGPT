import "server-only";

import OpenAI from "openai";
import {
  executeMemoryToolCall,
  extractMemoryToolCalls,
} from "@/lib/server/memory/toolExecutor";

type ResponseCreateBaseParams = Omit<
  OpenAI.Responses.ResponseCreateParamsStreaming,
  "stream"
>;

const MAX_MEMORY_TOOL_ROUNDS = 2;

async function buildToolOutputs(response: OpenAI.Responses.Response) {
  const calls = extractMemoryToolCalls(response);
  if (calls.length === 0) return null;

  return Promise.all(calls.map((call) => executeMemoryToolCall(call)));
}

function buildFollowUpParams(
  requestParams: ResponseCreateBaseParams,
  previousResponseId: string,
  outputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]
): ResponseCreateBaseParams {
  return {
    ...requestParams,
    input: outputs,
    previous_response_id: previousResponseId,
  };
}

export async function createResponseWithMemoryTools(
  openai: OpenAI,
  requestParams: ResponseCreateBaseParams,
  signal?: AbortSignal
) {
  let response = await openai.responses.create(requestParams, { signal });

  for (let round = 0; round < MAX_MEMORY_TOOL_ROUNDS; round += 1) {
    const outputs = await buildToolOutputs(response);
    if (!outputs) return response;

    response = await openai.responses.create(
      buildFollowUpParams(requestParams, response.id, outputs),
      { signal }
    );
  }

  return response;
}

export function createMemoryToolEventStream(
  openai: OpenAI,
  requestParams: ResponseCreateBaseParams,
  signal?: AbortSignal
) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let currentParams = requestParams;

      try {
        for (let round = 0; round <= MAX_MEMORY_TOOL_ROUNDS; round += 1) {
          const stream = await openai.responses.create(
            { ...currentParams, stream: true },
            { signal }
          );
          let completedResponse: OpenAI.Responses.Response | null = null;

          for await (const event of stream) {
            if (signal?.aborted) break;
            if (event.type === "response.completed") {
              completedResponse = event.response;
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }

          if (signal?.aborted) break;
          if (!completedResponse) break;

          const outputs = await buildToolOutputs(completedResponse);
          if (!outputs || round === MAX_MEMORY_TOOL_ROUNDS) break;

          currentParams = buildFollowUpParams(
            requestParams,
            completedResponse.id,
            outputs
          );
        }

        if (!signal?.aborted) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
        controller.close();
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "AbortError" || signal?.aborted)
        ) {
          console.info("[chat] Stream abortado pelo cliente — fechando upstream.");
          try {
            controller.close();
          } catch {
            // controller ja pode estar fechado
          }
          return;
        }

        controller.error(error);
      }
    },
    cancel() {
      console.info("[chat] ReadableStream.cancel — cliente desconectou.");
    },
  });
}
