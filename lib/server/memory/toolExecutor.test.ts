import OpenAI from "openai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/memories/data", () => ({
  createMemory: vi.fn(),
}));
vi.mock("@/lib/server/memory/indexStore", () => ({
  searchMemoryContext: vi.fn(),
}));

import { MEMORY_TOOL_NAMES } from "@/lib/server/chatRequest";
import { createMemory } from "@/app/api/memories/data";
import { searchMemoryContext } from "@/lib/server/memory/indexStore";
import {
  executeMemoryToolCall,
  extractMemoryToolCalls,
} from "@/lib/server/memory/toolExecutor";

const createMemoryMock = vi.mocked(createMemory);
const searchMemoryContextMock = vi.mocked(searchMemoryContext);

function functionCall(
  name: string,
  args: Record<string, unknown>
): OpenAI.Responses.ResponseFunctionToolCall {
  return {
    type: "function_call",
    name,
    arguments: JSON.stringify(args),
    call_id: `call-${name}`,
  };
}

describe("memory tool executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts only known memory function calls", () => {
    const response = {
      output: [
        functionCall(MEMORY_TOOL_NAMES.search, { query: "memoria", topK: 3 }),
        functionCall("other_tool", {}),
        { type: "message", id: "msg", status: "completed", content: [] },
      ],
    } as unknown as OpenAI.Responses.Response;

    expect(extractMemoryToolCalls(response)).toHaveLength(1);
    expect(extractMemoryToolCalls(response)[0].name).toBe(
      MEMORY_TOOL_NAMES.search
    );
  });

  it("searches memory chunks and returns serialized results", async () => {
    searchMemoryContextMock.mockResolvedValueOnce([
      {
        text: "Anders pediu duas tools de memoria.",
        score: 0.91,
        conversationId: "conv-1",
        conversationTitle: "Memoria",
        messageIds: ["msg-1"],
        timestamp: "2026-06-17T10:00:00.000Z",
      },
    ]);

    const output = await executeMemoryToolCall(
      functionCall(MEMORY_TOOL_NAMES.search, {
        query: "duas tools de memoria",
        topK: 99,
      })
    );

    expect(searchMemoryContextMock).toHaveBeenCalledWith(
      "duas tools de memoria",
      { topK: 8 }
    );
    expect(JSON.parse(String(output.output))).toMatchObject({
      ok: true,
      results: [{ conversationId: "conv-1" }],
    });
  });

  it("creates active memory with sanitized category and priority", async () => {
    createMemoryMock.mockResolvedValueOnce({
      id: "mem-1",
      content: "Anders prefere respostas diretas.",
      category: "preferences",
      priority: 20,
      isActive: true,
      createdAt: new Date("2026-06-17T10:00:00.000Z"),
      updatedAt: new Date("2026-06-17T10:00:00.000Z"),
    });

    const output = await executeMemoryToolCall(
      functionCall(MEMORY_TOOL_NAMES.remember, {
        content: "Anders prefere respostas diretas.",
        category: "preferences",
        priority: 200,
      })
    );

    expect(createMemoryMock).toHaveBeenCalledWith({
      content: "Anders prefere respostas diretas.",
      category: "preferences",
      priority: 20,
      isActive: true,
    });
    expect(JSON.parse(String(output.output))).toMatchObject({
      ok: true,
      memory: { id: "mem-1", isActive: true },
    });
  });
});
