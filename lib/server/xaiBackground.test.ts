import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(), get: vi.fn(), update: vi.fn(), apply: vi.fn(), conversation: vi.fn(),
}));
vi.mock("@/lib/server/xaiChat", () => ({
  createXAIClient: () => ({ responses: { create: mocks.create } }),
  buildXAIResponseCreateParams: () => ({ model: "grok-4.7", input: [] }),
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
import { cancelXAIBackgroundJob, isXAIBackgroundJobActive, recoverInterruptedXAIBackgroundJob, startXAIBackgroundJob } from "./xaiBackground";

const binding = { responseId: "xai-test", conversationId: "conv-1", assistantMessageId: "msg-1" };
const params = { ...binding, body: { input: [{ role: "user" as const, content: "Pesquisa sintética" }] } };
const completed = { id: "upstream", status: "completed", error: null, output: [] };
let status: string;
beforeEach(() => {
  vi.resetAllMocks();
  status = "queued";
  mocks.get.mockImplementation(async () => ({ ...binding, provider: "xai", status }));
  mocks.update.mockImplementation(async (_id, updates) => { status = updates.status ?? status; return { ...binding, status }; });
  mocks.apply.mockImplementation(async (input) => ({
    id: "msg-1", backgroundJob: { responseId: binding.responseId, status: input.response.status === "incomplete" ? "failed" : input.response.status },
  }));
  mocks.conversation.mockImplementation(async () => ({
    messages: [{ id: "msg-1", backgroundJob: { responseId: binding.responseId, status } }],
  }));
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
describe("jobs Grok server-side", () => {
  it("recupera falha parcial do índice sem sobrescrever a conclusão já salva", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.create.mockResolvedValue(completed);
    let persisted: unknown = null;
    mocks.apply.mockImplementation(async (input) => {
      persisted = { id: "msg-1", backgroundJob: { responseId: binding.responseId, status: input.response.status } };
      return persisted;
    });
    mocks.conversation.mockImplementation(async () => ({ messages: persisted ? [persisted] : [] }));
    mocks.update.mockImplementationOnce(async () => { status = "in_progress"; })
      .mockRejectedValueOnce(new Error("disk temporarily unavailable"));
    await startXAIBackgroundJob(params);
    expect(mocks.apply).toHaveBeenCalledOnce();
    expect(status).toBe("in_progress");
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(mocks.apply).toHaveBeenCalledOnce();
    expect(status).toBe("completed");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
  it("mantém job vivo, evita chamada duplicada e não recupera enquanto executa", async () => {
    const upstream = deferred<typeof completed>();
    mocks.create.mockReturnValue(upstream.promise);
    const run = startXAIBackgroundJob(params);
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(isXAIBackgroundJobActive(binding.responseId)).toBe(true);
    await startXAIBackgroundJob(params);
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ stream: false }),
      expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 900000, maxRetries: 0 }));
    upstream.resolve(completed);
    await run;
    expect(status).toBe("completed");
    expect(isXAIBackgroundJobActive(binding.responseId)).toBe(false);
  });
  it("cancelamento aborta upstream e descarta retorno tardio", async () => {
    const upstream = deferred<typeof completed>();
    mocks.create.mockReturnValue(upstream.promise);
    const run = startXAIBackgroundJob(params);
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const signal = mocks.create.mock.calls[0][1].signal;
    await cancelXAIBackgroundJob(binding);
    upstream.resolve(completed);
    await run;
    expect(signal.aborted).toBe(true);
    expect(status).toBe("cancelled");
    expect(mocks.apply).toHaveBeenCalledOnce();
  });
  it("cerca a corrida em que cancel chega enquanto completion aguarda lock da conversa", async () => {
    const lock = deferred<void>();
    let persistedCompletion = false;
    mocks.create.mockResolvedValue(completed);
    mocks.apply.mockImplementationOnce(async (input) => {
      await lock.promise;
      persistedCompletion = input.shouldApply();
      return persistedCompletion ? { id: "msg-1" } : null;
    });
    const run = startXAIBackgroundJob(params);
    await vi.waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce());
    const cancel = cancelXAIBackgroundJob(binding);
    lock.resolve();
    await Promise.all([run, cancel]);
    expect(persistedCompletion).toBe(false);
    expect(status).toBe("cancelled");
    expect(mocks.update.mock.calls.some(([, value]) => value.status === "completed")).toBe(false);
  });
  it("preserva uma conclusão já persistida ao chegar cancelamento atrasado", async () => {
    status = "completed";
    const result = await cancelXAIBackgroundJob(binding);
    expect(result?.backgroundJob?.status).toBe("completed");
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("marca restart como interrupted sem repetir cobrança", async () => {
    await recoverInterruptedXAIBackgroundJob(binding);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(status).toBe("failed");
    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ streamStatus: "interrupted", expectedResponseId: binding.responseId }));
  });
  it("não altera job com vínculo incompatível", async () => {
    mocks.get.mockResolvedValue({ ...binding, provider: "xai", conversationId: "outra", status: "queued" });
    await startXAIBackgroundJob(params);
    await cancelXAIBackgroundJob(binding);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("persiste erro de limite sem registrar mensagem bruta do provider", async () => {
    mocks.create.mockRejectedValue({ status: 429, message: "provider-internal-detail" });
    await startXAIBackgroundJob(params);
    expect(status).toBe("failed");
    expect(mocks.apply.mock.calls[0][0].response.error.message).toContain("limite de uso");
    expect(mocks.apply.mock.calls[0][0].response.error.message).not.toContain("provider-internal");
  });
});
