import { mkdtemp, mkdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteWorkspaceEntry,
  listWorkspaceTree,
  readWorkspaceFile,
  renameWorkspaceEntry,
  resolveWorkspacePath,
  writeWorkspaceFile,
} from "@/lib/server/studioWorkspaceFs";

let root: string;
let outside: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "studio-ws-"));
  outside = await mkdtemp(path.join(tmpdir(), "studio-fora-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("resolveWorkspacePath", () => {
  it("accepts legitimate nested paths", async () => {
    const resolved = await resolveWorkspacePath(root, "utils/helpers.py");

    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.absolutePath).toBe(path.join(root, "utils/helpers.py"));
    }
  });

  it("rejects traversal, absolute paths and empty paths", async () => {
    for (const candidate of ["../fuga.py", "a/../../fuga.py", "/etc/passwd", ""]) {
      const resolved = await resolveWorkspacePath(root, candidate);
      expect(resolved.ok, candidate).toBe(false);
    }
  });

  it("rejects characters outside the allowlist", async () => {
    for (const candidate of ["a\0b.py", "log|teste.txt", "seg\nredo.py"]) {
      const resolved = await resolveWorkspacePath(root, candidate);
      expect(resolved.ok, JSON.stringify(candidate)).toBe(false);
    }
  });

  it("rejects paths longer than the limit", async () => {
    const longPath = `${"a".repeat(321)}.py`;
    const resolved = await resolveWorkspacePath(root, longPath);
    expect(resolved.ok).toBe(false);
  });

  it("rejects paths escaping through a symlinked directory", async () => {
    await symlink(outside, path.join(root, "atalho"));
    const resolved = await resolveWorkspacePath(root, "atalho/fuga.py");
    expect(resolved.ok).toBe(false);
  });
});

describe("workspace file operations", () => {
  it("writes creating intermediate directories and reads back", async () => {
    const written = await writeWorkspaceFile(root, "pasta/nova/arquivo.py", "print('oi')\n");
    expect(written.ok).toBe(true);

    const read = await readWorkspaceFile(root, "pasta/nova/arquivo.py");
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.content).toBe("print('oi')\n");
  });

  it("gives new files the same owner as the workspace root", async () => {
    await writeWorkspaceFile(root, "dono.py", "x = 1\n");
    const rootInfo = await stat(root);
    const fileInfo = await stat(path.join(root, "dono.py"));

    expect(fileInfo.uid).toBe(rootInfo.uid);
    expect(fileInfo.gid).toBe(rootInfo.gid);
  });

  it("refuses to read missing, oversized or binary files", async () => {
    const missing = await readWorkspaceFile(root, "nao-existe.py");
    expect(missing.ok).toBe(false);

    await writeFile(path.join(root, "grande.txt"), Buffer.alloc(1024 * 1024 + 1, 97));
    const oversized = await readWorkspaceFile(root, "grande.txt");
    expect(oversized.ok).toBe(false);

    await writeFile(path.join(root, "binario.bin"), Buffer.from([0x89, 0x50, 0x00, 0x47]));
    const binary = await readWorkspaceFile(root, "binario.bin");
    expect(binary.ok).toBe(false);
  });

  it("lists the tree with kind, size and editability", async () => {
    await writeWorkspaceFile(root, "main.py", "print('oi')\n");
    await mkdir(path.join(root, "utils"));
    await writeWorkspaceFile(root, "utils/helpers.py", "x = 1\n");
    await writeFile(path.join(root, "dados.bin"), Buffer.from([0x00, 0x01]));

    const tree = await listWorkspaceTree(root);
    const byPath = new Map(tree.map((entry) => [entry.path, entry]));

    expect(byPath.get("utils")?.kind).toBe("directory");
    expect(byPath.get("main.py")?.editable).toBe(true);
    expect(byPath.get("utils/helpers.py")?.kind).toBe("file");
    expect(byPath.get("dados.bin")?.editable).toBe(false);
    expect(byPath.get("main.py")?.size).toBeGreaterThan(0);
  });

  it("hides jail runtime directories and files from the tree", async () => {
    await writeWorkspaceFile(root, "main.py", "print('oi')\n");
    await writeWorkspaceFile(root, ".env", "X=1\n");
    await mkdir(path.join(root, ".cache", "matplotlib"), { recursive: true });
    await writeFile(path.join(root, ".cache", "matplotlib", "fontlist.json"), "{}");
    await mkdir(path.join(root, ".config"));
    await mkdir(path.join(root, ".ipython"));
    await mkdir(path.join(root, ".jupyter"));
    await mkdir(path.join(root, ".local"));
    await writeFile(path.join(root, ".bash_history"), "ls\n");
    await writeFile(path.join(root, ".python_history"), "x = 1\n");
    await writeFile(path.join(root, ".gaucho-kernel-b0bfa68a.json"), "{}");

    const tree = await listWorkspaceTree(root);
    const paths = tree.map((entry) => entry.path);

    expect(paths).toContain("main.py");
    expect(paths).toContain(".env");
    expect(paths.some((candidate) => candidate.startsWith(".cache"))).toBe(false);
    expect(paths).not.toContain(".config");
    expect(paths).not.toContain(".ipython");
    expect(paths).not.toContain(".jupyter");
    expect(paths).not.toContain(".local");
    expect(paths).not.toContain(".bash_history");
    expect(paths).not.toContain(".python_history");
    expect(paths).not.toContain(".gaucho-kernel-b0bfa68a.json");
  });

  it("renames and deletes entries inside the workspace", async () => {
    await writeWorkspaceFile(root, "antigo.py", "x = 1\n");

    const renamed = await renameWorkspaceEntry(root, "antigo.py", "novo.py");
    expect(renamed.ok).toBe(true);
    expect((await readWorkspaceFile(root, "novo.py")).ok).toBe(true);
    expect((await readWorkspaceFile(root, "antigo.py")).ok).toBe(false);

    const deleted = await deleteWorkspaceEntry(root, "novo.py");
    expect(deleted.ok).toBe(true);
    expect((await readWorkspaceFile(root, "novo.py")).ok).toBe(false);
  });

  it("refuses rename targets that escape the workspace", async () => {
    await writeWorkspaceFile(root, "arquivo.py", "x = 1\n");
    const renamed = await renameWorkspaceEntry(root, "arquivo.py", "../fuga.py");
    expect(renamed.ok).toBe(false);
  });
});
