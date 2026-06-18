import "server-only";

import OpenAI from "openai";
import type { MemoryCategory } from "@/types";
import { createMemory } from "@/app/api/memories/data";
import {
  MEMORY_TOOL_NAMES,
  type MemoryToolName,
} from "@/lib/server/chatRequest";
import { searchMemoryContext } from "@/lib/server/memory/indexStore";

const VALID_CATEGORIES = new Set<MemoryCategory>([
  "personal",
  "professional",
  "preferences",
  "projects",
  "technical",
  "other",
]);

export function isMemoryToolName(name: string): name is MemoryToolName {
  return (
    name === MEMORY_TOOL_NAMES.remember || name === MEMORY_TOOL_NAMES.search
  );
}

export function extractMemoryToolCalls(response: OpenAI.Responses.Response) {
  return response.output.filter(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
      item.type === "function_call" && isMemoryToolName(item.name)
  );
}

function parseArguments(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Argumentos da tool precisam ser um objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanTopK(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 5;
  return Math.min(Math.max(Math.round(numberValue), 1), 8);
}

function cleanPriority(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(Math.max(Math.round(numberValue), 0), 20);
}

function cleanCategory(value: unknown): MemoryCategory {
  return typeof value === "string" && VALID_CATEGORIES.has(value as MemoryCategory)
    ? (value as MemoryCategory)
    : "other";
}

async function executeSearchMemory(args: Record<string, unknown>) {
  const query = cleanString(args.query);
  if (!query) {
    return {
      ok: false,
      error: "query_required",
      message: "Informe uma query para buscar na memoria.",
    };
  }

  const results = await searchMemoryContext(query, {
    topK: cleanTopK(args.topK),
  });

  return {
    ok: true,
    results,
  };
}

async function executeRememberMemory(args: Record<string, unknown>) {
  const content = cleanString(args.content);
  if (!content) {
    return {
      ok: false,
      error: "content_required",
      message: "Informe o conteudo da memoria a ser salva.",
    };
  }

  const memory = await createMemory({
    content,
    category: cleanCategory(args.category),
    priority: cleanPriority(args.priority),
    isActive: true,
  });

  return {
    ok: true,
    memory: {
      id: memory.id,
      content: memory.content,
      category: memory.category,
      priority: memory.priority,
      isActive: memory.isActive,
    },
  };
}

export async function executeMemoryToolCall(
  call: OpenAI.Responses.ResponseFunctionToolCall
): Promise<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> {
  let output: unknown;

  try {
    if (!isMemoryToolName(call.name)) {
      output = {
        ok: false,
        error: "unknown_memory_tool",
        message: `Tool de memoria desconhecida: ${call.name}`,
      };
    } else {
      const args = parseArguments(call.arguments);
      output =
        call.name === MEMORY_TOOL_NAMES.search
          ? await executeSearchMemory(args)
          : await executeRememberMemory(args);
    }
  } catch (error) {
    output = {
      ok: false,
      error: "memory_tool_failed",
      message:
        error instanceof Error
          ? error.message
          : "Falha desconhecida ao executar tool de memoria.",
    };
  }

  return {
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify(output),
  };
}
