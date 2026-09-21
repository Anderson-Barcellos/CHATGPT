import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getJob: vi.fn(), getConversation: vi.fn(), active: vi.fn(), recover: vi.fn(), cancel: vi.fn(), openai: vi.fn(), auth: vi.fn(), authenticated: vi.fn() }));
vi.mock("@/lib/server/auth", () => ({ isAuthEnabled: mocks.auth, isAuthenticatedRequest: mocks.authenticated }));
vi.mock("@/lib/server/chatRequest", () => ({ createOpenAIClient: mocks.openai }));
vi.mock("@/lib/server/chatBackgroundJobStore", () => ({ getBackgroundJobByResponseId: mocks.getJob, updateBackgroundJobByResponseId: vi.fn() }));
vi.mock("@/app/api/conversations/data", () => ({ getConversation: mocks.getConversation, patchConversationMessages: vi.fn() }));
vi.mock("@/lib/server/xaiBackground", () => ({ isXAIBackgroundJobActive: mocks.active, recoverInterruptedXAIBackgroundJob: mocks.recover, cancelXAIBackgroundJob: mocks.cancel }));
import { POST as sync } from "./sync/route";
import { POST as cancel } from "./cancel/route";

const binding = { responseId: "xai-synthetic", conversationId: "conv", assistantMessageId: "msg" };
const message = (status: string) => ({ id: "msg", backgroundJob: { responseId: binding.responseId, status } });
function request(body = binding) {
  return new NextRequest("http://localhost/api/chat/background/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockReturnValue(false);
  mocks.getJob.mockResolvedValue({ ...binding, provider: "xai", status: "in_progress" });
  mocks.getConversation.mockResolvedValue({ messages: [message("in_progress")] });
  mocks.active.mockReturnValue(true);
});

describe("rotas background Grok", () => {
  it("sync de execução viva não tenta retrieve OpenAI nem recovery", async () => {
    const response = await sync(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "in_progress" });
    expect(mocks.openai).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
  });
  it("sync recupera interrupção do executor sem recriar chamada", async () => {
    mocks.active.mockReturnValue(false);
    mocks.recover.mockImplementation(async () => { mocks.getConversation.mockResolvedValue({ messages: [message("failed")] }); });
    const response = await sync(request());
    expect(await response.json()).toMatchObject({ status: "failed" });
    expect(mocks.recover).toHaveBeenCalledOnce();
    expect(mocks.openai).not.toHaveBeenCalled();
  });
  it.each([sync, cancel])("rejeita vínculo divergente antes de chamar executor", async (route) => {
    const response = await route(request({ ...binding, assistantMessageId: "outra" }));
    expect(response.status).toBe(404);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.openai).not.toHaveBeenCalled();
  });
  it.each([sync, cancel])("não encaminha identificador xai desconhecido para OpenAI", async (route) => {
    mocks.getJob.mockResolvedValue(null);
    expect((await route(request())).status).toBe(404);
    expect(mocks.openai).not.toHaveBeenCalled();
  });
  it("cancel devolve completed quando a conclusão venceu a corrida", async () => {
    mocks.cancel.mockResolvedValue(message("completed"));
    const response = await cancel(request());
    expect(await response.json()).toMatchObject({ status: "completed", message: { backgroundJob: { status: "completed" } } });
  });
  it("autentica antes de consultar metadados do job", async () => {
    mocks.auth.mockReturnValue(true);
    mocks.authenticated.mockResolvedValue(false);
    expect((await sync(request())).status).toBe(401);
    expect(mocks.getJob).not.toHaveBeenCalled();
  });
});
