import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import type { Message } from "@/types";
import { jsonError } from "@/lib/api/errors";
import { isAuthenticatedRequest, isAuthEnabled } from "@/lib/server/auth";
import { createOpenAIClient } from "@/lib/server/chatRequest";
import {
  applyBackgroundResponseToConversation,
  isBackgroundResponseMode,
  toBackgroundJobStatus,
} from "@/lib/server/chatBackgroundJob";
import type { BackgroundResponseMode } from "@/lib/server/chatBackgroundJob";
import {
  isPendingBackgroundJobStatus,
  listPendingBackgroundJobs,
  updateBackgroundJobByResponseId,
  upsertBackgroundJob,
} from "@/lib/server/chatBackgroundJobStore";
import type {
  ChatBackgroundJobCreateInput,
  ChatBackgroundJobRecord,
} from "@/lib/server/chatBackgroundJobStore";
import { listConversations } from "@/app/api/conversations/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RECONCILE_LIMIT = 8;
const MAX_RECONCILE_LIMIT = 16;

type ReconcileResult = {
  responseId: string;
  conversationId: string;
  assistantMessageId: string;
  status: ChatBackgroundJobRecord["status"];
  message?: Message;
  error?: string;
};

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para sincronizar respostas em segundo plano.",
    code: "unauthorized",
  });
}

function clampLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_RECONCILE_LIMIT;
  }
  return Math.min(Math.max(Math.round(value), 1), MAX_RECONCILE_LIMIT);
}

function isPendingBackgroundMessage(message: Message): boolean {
  return (
    message.role === "assistant" &&
    !!message.backgroundJob?.responseId &&
    isPendingBackgroundJobStatus(message.backgroundJob.status) &&
    isBackgroundResponseMode(message.responseMode)
  );
}

async function collectLegacyBackgroundJobs(
  knownResponseIds: Set<string>,
  remainingSlots: number
): Promise<ChatBackgroundJobRecord[]> {
  if (remainingSlots <= 0) return [];

  const conversations = await listConversations();
  const created: ChatBackgroundJobRecord[] = [];

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      if (!isPendingBackgroundMessage(message)) continue;
      const backgroundJob = message.backgroundJob;
      const responseId = backgroundJob?.responseId;
      if (!responseId || knownResponseIds.has(responseId)) continue;

      const input: ChatBackgroundJobCreateInput = {
        responseId,
        conversationId: conversation.id,
        assistantMessageId: message.id,
        responseMode: message.responseMode as BackgroundResponseMode,
        status: backgroundJob.status,
        error: backgroundJob.error,
      };
      const record = await upsertBackgroundJob(input);
      knownResponseIds.add(responseId);
      created.push(record);

      if (created.length >= remainingSlots) return created;
    }
  }

  return created;
}

async function reconcileJob(
  openai: OpenAI,
  job: ChatBackgroundJobRecord
): Promise<ReconcileResult> {
  try {
    const response = await openai.responses.retrieve(job.responseId);
    const status = toBackgroundJobStatus(response.status);
    const message = await applyBackgroundResponseToConversation({
      conversationId: job.conversationId,
      assistantMessageId: job.assistantMessageId,
      response,
    });

    await updateBackgroundJobByResponseId(response.id, {
      status: message ? status : "failed",
      lastSyncedAt: new Date().toISOString(),
      error: message ? response.error?.message : "Mensagem vinculada nao encontrada.",
    });

    return {
      responseId: response.id,
      conversationId: job.conversationId,
      assistantMessageId: job.assistantMessageId,
      status: message ? status : "failed",
      ...(message ? { message } : { error: "Mensagem vinculada nao encontrada." }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar job.";
    const shouldFailPermanently =
      error instanceof OpenAI.APIError && error.status === 404;

    await updateBackgroundJobByResponseId(job.responseId, {
      ...(shouldFailPermanently ? { status: "failed" as const } : {}),
      lastSyncedAt: new Date().toISOString(),
      error: message,
    });

    return {
      responseId: job.responseId,
      conversationId: job.conversationId,
      assistantMessageId: job.assistantMessageId,
      status: shouldFailPermanently ? "failed" : job.status,
      error: message,
    };
  }
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const openai = createOpenAIClient();
  if (!openai) {
    return jsonError(503, "OpenAI API key is missing", {
      message: "OPENAI_API_KEY nao configurada no servidor.",
      code: "chat_openai_api_key_missing",
    });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const limit = clampLimit(body.limit);
  const storedJobs = await listPendingBackgroundJobs(limit);
  const knownResponseIds = new Set(storedJobs.map((job) => job.responseId));
  const legacyJobs = await collectLegacyBackgroundJobs(
    knownResponseIds,
    limit - storedJobs.length
  );
  const jobs = [...storedJobs, ...legacyJobs].slice(0, limit);
  const results: ReconcileResult[] = [];

  for (const job of jobs) {
    results.push(await reconcileJob(openai, job));
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    requestedLimit: limit,
    processedCount: results.length,
    results,
  });
}
