import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let records: unknown[] = [];

vi.mock("@/lib/server/jsonFileStore", () => ({
  readDataFile: vi.fn(async () => records),
  writeDataFile: vi.fn(async (_fileName: string, value: unknown[]) => {
    records = value;
  }),
  withDataFileLock: vi.fn(async (_fileName: string, fn: () => Promise<unknown>) => fn()),
}));

describe("chatBackgroundJobStore", () => {
  beforeEach(() => {
    records = [];
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "job-generated"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("upserts jobs by response id and lists pending jobs oldest first", async () => {
    const {
      listPendingBackgroundJobs,
      upsertBackgroundJob,
    } = await import("./chatBackgroundJobStore");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T12:00:00.000Z"));
    await upsertBackgroundJob({
      responseId: "resp-later",
      conversationId: "conv-1",
      assistantMessageId: "msg-2",
      responseMode: "deepsearch_high",
      status: "in_progress",
    });
    vi.setSystemTime(new Date("2026-06-22T12:00:01.000Z"));
    await upsertBackgroundJob({
      responseId: "resp-earlier",
      conversationId: "conv-1",
      assistantMessageId: "msg-1",
      responseMode: "document",
      status: "queued",
    });

    const pending = await listPendingBackgroundJobs(10);

    expect(pending.map((job) => job.responseId)).toEqual([
      "resp-later",
      "resp-earlier",
    ]);

    await upsertBackgroundJob({
      responseId: "resp-earlier",
      conversationId: "conv-1",
      assistantMessageId: "msg-1",
      responseMode: "document",
      status: "completed",
    });

    expect(await listPendingBackgroundJobs(10)).toHaveLength(1);
  });

  it("updates a job and clears stale errors when a later sync succeeds", async () => {
    const {
      updateBackgroundJobByResponseId,
      upsertBackgroundJob,
    } = await import("./chatBackgroundJobStore");

    await upsertBackgroundJob({
      responseId: "resp-1",
      conversationId: "conv-1",
      assistantMessageId: "msg-1",
      responseMode: "deepsearch_medium",
      status: "in_progress",
      error: "Falha temporaria",
    });

    const updated = await updateBackgroundJobByResponseId("resp-1", {
      status: "completed",
      lastSyncedAt: "2026-06-22T12:00:00.000Z",
    });

    expect(updated).toMatchObject({
      responseId: "resp-1",
      status: "completed",
      lastSyncedAt: "2026-06-22T12:00:00.000Z",
    });
    expect(updated).not.toHaveProperty("error");
  });

  it("prunes old terminal jobs while preserving pending jobs", async () => {
    const { listBackgroundJobs, upsertBackgroundJob } = await import("./chatBackgroundJobStore");
    const oldDate = "2026-05-01T00:00:00.000Z";
    records = [
      {
        jobId: "old-completed",
        responseId: "resp-old",
        conversationId: "conv-old",
        assistantMessageId: "msg-old",
        responseMode: "document",
        status: "completed",
        createdAt: oldDate,
        updatedAt: oldDate,
      },
      {
        jobId: "old-pending",
        responseId: "resp-pending",
        conversationId: "conv-pending",
        assistantMessageId: "msg-pending",
        responseMode: "document",
        status: "in_progress",
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    ];

    await upsertBackgroundJob({
      responseId: "resp-new",
      conversationId: "conv-new",
      assistantMessageId: "msg-new",
      responseMode: "deepsearch_high",
      status: "completed",
    });

    const jobs = await listBackgroundJobs();

    expect(jobs.map((job) => job.responseId)).toContain("resp-pending");
    expect(jobs.map((job) => job.responseId)).toContain("resp-new");
    expect(jobs.map((job) => job.responseId)).not.toContain("resp-old");
  });
});
