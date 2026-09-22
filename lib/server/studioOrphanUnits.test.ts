import { describe, expect, it, vi } from "vitest";
import { verifyStudioServiceOwner } from "./studioOrphanUnits";

const invocationId = "a".repeat(32);
const env = { INVOCATION_ID: invocationId, GAUCHO_SERVICE_UNIT: "fixture.service" };
const stdout = `Id=fixture.service\nInvocationID=${invocationId}\nControlGroup=/system.slice/fixture.service\nActiveState=active\n`;
const readCgroup = async () => "0::/system.slice/fixture.service\n";

describe("proprietário do Studio", () => {
  it("confere invocação, unit e cgroup sem executar stop/reset", async () => {
    const exec = vi.fn(async () => ({ stdout, stderr: "" }));
    await expect(verifyStudioServiceOwner(env, exec, readCgroup)).resolves.toEqual({ unit: "fixture.service", invocationId });
    expect(exec).toHaveBeenCalledExactlyOnceWith("systemctl", ["show", "fixture.service", "--property=Id,InvocationID,ControlGroup,ActiveState"]);
  });
  it.each([
    ["invocação diferente", stdout.replace(invocationId, "b".repeat(32)), "0::/system.slice/fixture.service"],
    ["outro processo", stdout, "0::/system.slice/other.service"],
    ["prefixo parcial", stdout, "0::/system.slice/fixture.service-other"],
    ["serviço inativo", stdout.replace("active", "inactive"), "0::/system.slice/fixture.service"],
    ["raiz genérica", stdout.replace("/system.slice/fixture.service", "/"), "0::/"],
  ])("recusa %s", async (_label, properties, cgroup) => {
    await expect(verifyStudioServiceOwner(env, async () => ({ stdout: properties, stderr: "" }), async () => cgroup)).rejects.toThrow("studio_runtime_owner_mismatch");
  });
  it("não aceita nome/env como prova suficiente", async () => {
    const exec = vi.fn();
    await expect(verifyStudioServiceOwner({ GAUCHO_SERVICE_UNIT: "fixture.service" }, exec, readCgroup)).rejects.toThrow("studio_runtime_owner_unavailable");
    expect(exec).not.toHaveBeenCalled();
  });
  it("não prossegue se systemd estiver indisponível", async () => {
    await expect(verifyStudioServiceOwner(env, async () => { throw new Error("ENOENT"); }, readCgroup)).rejects.toThrow("ENOENT");
  });
});
