import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), apply: vi.fn(), conversation: vi.fn(),
}));
vi.mock("@/lib/server/chatBackgroundJobStore", () => ({
  getBackgroundJobByResponseId: mocks.get,
  updateBackgroundJobByResponseId: mocks.update,
}));
vi.mock("@/lib/server/chatBackgroundJob", () => ({
  applyBackgroundResponseToConversation: mocks.apply,
  toBackgroundJobStatus: (status: string) => ["completed", "cancelled", "queued", "in_progress"].includes(status) ? status : "failed",
}));
vi.mock("@/app/api/conversations/data", () => ({ getConversation: mocks.conversation }));
import * as xaiBackground from "./xaiBackground";
import { cancelXAIBackgroundJob, recoverInterruptedXAIBackgroundJob } from "./xaiBackground";

const binding = { responseId: "xai-test", conversationId: "conv-1", assistantMessageId: "msg-1" };
let status: string;
beforeEach(() => {
  vi.resetAllMocks();
  status = "in_progress";
  mocks.get.mockImplementation(async () => ({ ...binding, provider: "xai", status }));
  mocks.update.mockImplementation(async (_id, updates) => { status = updates.status ?? status; return { ...binding, status }; });
  mocks.apply.mockImplementation(async (input) => ({
    id: "msg-1", backgroundJob: { responseId: binding.responseId, status: input.response.status === "incomplete" ? "failed" : input.response.status },
  }));
  mocks.conversation.mockImplementation(async () => ({
    messages: [{ id: "msg-1", backgroundJob: { responseId: binding.responseId, status } }],
  }));
});

describe("jobs Grok legados persistidos", () => {
  it("não inicia mais jobs xAI: só finaliza os que já existem", () => {
    expect(Object.keys(xaiBackground).sort()).toEqual([
      "cancelXAIBackgroundJob",
      "recoverInterruptedXAIBackgroundJob",
    ]);
  });
  it("marca o job interrompido como failed sem repetir a chamada", async () => {
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(status).toBe("failed");
    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ streamStatus: "interrupted", expectedResponseId: binding.responseId }));
  });
  it("alinha o índice com a conclusão já salva na conversa sem sobrescrevê-la", async () => {
    mocks.conversation.mockResolvedValue({
      messages: [{ id: "msg-1", backgroundJob: { responseId: binding.responseId, status: "completed" } }],
    });
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(status).toBe("completed");
  });
  it("cancela um job legado ainda em andamento", async () => {
    const result = await cancelXAIBackgroundJob(binding);
    expect(result?.backgroundJob?.status).toBe("cancelled");
    expect(status).toBe("cancelled");
  });
  it("preserva uma conclusão já persistida ao chegar cancelamento atrasado", async () => {
    status = "completed";
    const result = await cancelXAIBackgroundJob(binding);
    expect(result?.backgroundJob?.status).toBe("completed");
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("não altera job com vínculo incompatível", async () => {
    mocks.get.mockResolvedValue({ ...binding, provider: "xai", conversationId: "outra", status: "queued" });
    await cancelXAIBackgroundJob(binding);
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
