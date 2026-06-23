import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isAuthEnabledMock = vi.fn();
const isAuthenticatedRequestMock = vi.fn();
const createOpenAIClientMock = vi.fn();
const applyBackgroundResponseToConversationMock = vi.fn();
const listPendingBackgroundJobsMock = vi.fn();
const updateBackgroundJobByResponseIdMock = vi.fn();
const upsertBackgroundJobMock = vi.fn();
const listConversationsMock = vi.fn();

vi.mock("@/lib/server/auth", () => ({
  isAuthEnabled: isAuthEnabledMock,
  isAuthenticatedRequest: isAuthenticatedRequestMock,
}));

vi.mock("@/lib/server/chatRequest", () => ({
  createOpenAIClient: createOpenAIClientMock,
}));

vi.mock("@/lib/server/chatBackgroundJob", () => ({
  applyBackgroundResponseToConversation: applyBackgroundResponseToConversationMock,
  isBackgroundResponseMode: (mode: unknown) =>
    mode === "document" || mode === "deepsearch_medium" || mode === "deepsearch_high",
  toBackgroundJobStatus: (status: string) =>
    status === "queued" || status === "in_progress" || status === "completed" || status === "cancelled"
      ? status
      : "failed",
}));

vi.mock("@/lib/server/chatBackgroundJobStore", () => ({
  isPendingBackgroundJobStatus: (status: string) =>
    status === "queued" || status === "in_progress",
  listPendingBackgroundJobs: listPendingBackgroundJobsMock,
  updateBackgroundJobByResponseId: updateBackgroundJobByResponseIdMock,
  upsertBackgroundJob: upsertBackgroundJobMock,
}));

vi.mock("@/app/api/conversations/data", () => ({
  listConversations: listConversationsMock,
}));

function request(body: unknown = {}) {
  return new NextRequest("http://localhost/api/chat/background/reconcile", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/chat/background/reconcile route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isAuthEnabledMock.mockReturnValue(false);
    isAuthenticatedRequestMock.mockResolvedValue(true);
    listConversationsMock.mockResolvedValue([]);
    updateBackgroundJobByResponseIdMock.mockResolvedValue(null);
  });

  it("retrieves pending jobs and applies completed responses to conversations", async () => {
    const response = { id: "resp-1", status: "completed", error: null };
    const message = {
      id: "msg-1",
      role: "assistant",
      content: "Final",
      timestamp: new Date().toISOString(),
      streamStatus: "completed",
    };
    listPendingBackgroundJobsMock.mockResolvedValue([
      {
        jobId: "job-1",
        responseId: "resp-1",
        conversationId: "conv-1",
        assistantMessageId: "msg-1",
        responseMode: "deepsearch_high",
        status: "in_progress",
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
    ]);
    createOpenAIClientMock.mockReturnValue({
      responses: {
        retrieve: vi.fn().mockResolvedValue(response),
      },
    });
    applyBackgroundResponseToConversationMock.mockResolvedValue(message);

    const { POST } = await import("./route");
    const result = await POST(request());

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({
      processedCount: 1,
      results: [
        {
          responseId: "resp-1",
          conversationId: "conv-1",
          assistantMessageId: "msg-1",
          status: "completed",
          message,
        },
      ],
    });
    expect(updateBackgroundJobByResponseIdMock).toHaveBeenCalledWith("resp-1", {
      status: "completed",
      lastSyncedAt: expect.any(String),
      error: undefined,
    });
  });

  it("imports legacy pending conversation messages into the job store", async () => {
    const response = { id: "resp-legacy", status: "completed", error: null };
    const legacyJob = {
      jobId: "job-legacy",
      responseId: "resp-legacy",
      conversationId: "conv-legacy",
      assistantMessageId: "msg-legacy",
      responseMode: "document",
      status: "in_progress",
      createdAt: "2026-06-22T10:00:00.000Z",
      updatedAt: "2026-06-22T10:00:00.000Z",
    };
    listPendingBackgroundJobsMock.mockResolvedValue([]);
    listConversationsMock.mockResolvedValue([
      {
        id: "conv-legacy",
        messages: [
          {
            id: "msg-legacy",
            role: "assistant",
            content: "",
            timestamp: new Date(),
            responseMode: "document",
            backgroundJob: {
              responseId: "resp-legacy",
              status: "in_progress",
              startedAt: "2026-06-22T10:00:00.000Z",
              updatedAt: "2026-06-22T10:00:00.000Z",
            },
          },
        ],
      },
    ]);
    upsertBackgroundJobMock.mockResolvedValue(legacyJob);
    createOpenAIClientMock.mockReturnValue({
      responses: {
        retrieve: vi.fn().mockResolvedValue(response),
      },
    });
    applyBackgroundResponseToConversationMock.mockResolvedValue({
      id: "msg-legacy",
      role: "assistant",
      content: "Final",
      timestamp: new Date().toISOString(),
      streamStatus: "completed",
    });

    const { POST } = await import("./route");
    const result = await POST(request({ limit: 1 }));

    expect(result.status).toBe(200);
    expect(upsertBackgroundJobMock).toHaveBeenCalledWith({
      responseId: "resp-legacy",
      conversationId: "conv-legacy",
      assistantMessageId: "msg-legacy",
      responseMode: "document",
      status: "in_progress",
      error: undefined,
    });
    await expect(result.json()).resolves.toMatchObject({
      processedCount: 1,
      results: [{ responseId: "resp-legacy", status: "completed" }],
    });
  });
});
