import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

export interface StudioServiceOwner { unit: string; invocationId: string }

export function studioServiceProperties(owner: StudioServiceOwner): string[] {
  return [`--property=BindsTo=${owner.unit}`, `--property=PartOf=${owner.unit}`, `--property=After=${owner.unit}`,
    `--description=Gaucho Studio owner=${owner.unit} invocation=${owner.invocationId}`];
}

export type SystemctlExec = (
  command: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string }>;

const execAsync = promisify(execFile);

/** Não para units: sessões antigas sem dono ficam para transição explícita. */
export async function verifyStudioServiceOwner(
  env: Readonly<Record<string, string | undefined>>,
  exec: SystemctlExec = (command, args) => execAsync(command, args, { timeout: 5_000 }),
  readCgroup: () => Promise<string> = () => readFile("/proc/self/cgroup", "utf8"),
): Promise<StudioServiceOwner> {
  const unit = env.GAUCHO_SERVICE_UNIT || "chatgpt.service";
  const invocationId = env.INVOCATION_ID || "";
  if (!/^[a-zA-Z0-9_.@-]+\.service$/.test(unit) || !/^[a-f0-9]{32}$/.test(invocationId)) throw new Error("studio_runtime_owner_unavailable");
  const { stdout } = await exec("systemctl", ["show", unit, "--property=Id,InvocationID,ControlGroup,ActiveState"]);
  const fields = Object.fromEntries(stdout.trim().split("\n").map(line => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const cgroups = (await readCgroup()).trim().split("\n").map(line => {
    const [hierarchy, controllers, ...rest] = line.split(":");
    return hierarchy === "0" || controllers?.split(",").includes("name=systemd") ? rest.join(":") : "";
  });
  if (fields.Id !== unit || fields.InvocationID !== invocationId || !["active", "activating"].includes(fields.ActiveState) ||
      !fields.ControlGroup?.startsWith("/") || fields.ControlGroup === "/" ||
      !cgroups.some(group => group === fields.ControlGroup || group.startsWith(`${fields.ControlGroup}/`))) throw new Error("studio_runtime_owner_mismatch");
  return { unit, invocationId };
}
