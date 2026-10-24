import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
vi.mock("@/lib/discover/store", async (original) => ({ ...await original<typeof import("@/lib/discover/store")>(), deleteDiscoverArticles: mocks.remove }));
import { DELETE } from "./route";
import { DiscoverDeleteError } from "@/lib/discover/store";
const request = (body: unknown) => new NextRequest("http://localhost/api/discover", { method: "DELETE", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(null); mocks.remove.mockResolvedValue({ deletedIds: ["one"] }); });
it("exige autenticação antes de tocar no armazenamento", async () => {
  mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await DELETE(request({ ids: ["one"] }))).status).toBe(401);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("devolve ids excluídos e proíbe cache", async () => {
  const response = await DELETE(request({ ids: ["one"] }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ deletedIds: ["one"] });
});
it.each([400, 409] as const)("mantém status %s para erro de seleção/curadoria", async (status) => {
  mocks.remove.mockRejectedValue(new DiscoverDeleteError("Indisponível", status));
  expect((await DELETE(request({ ids: ["one"] }))).status).toBe(status);
});
it("limita corpo e recusa JSON inválido", async () => {
  expect((await DELETE(new NextRequest("http://localhost/api/discover", { method: "DELETE", body: "{" }))).status).toBe(400);
  expect((await DELETE(request({ ids: ["x".repeat(17000)] }))).status).toBe(413);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("não expõe erros internos nem informa sucesso se a persistência falhar", async () => {
  mocks.remove.mockRejectedValue(new Error("caminho-privado"));
  const response = await DELETE(request({ ids: ["one"] })); expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("caminho-privado");
});
