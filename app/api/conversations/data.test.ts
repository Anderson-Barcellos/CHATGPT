import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readDataFileMock = vi.fn();
const writeDataFileMock = vi.fn();
const withDataFileLockMock = vi.fn();

vi.mock("@/lib/server/jsonFileStore", () => ({
  readDataFile: readDataFileMock,
  writeDataFile: writeDataFileMock,
  withDataFileLock: withDataFileLockMock,
}));

vi.mock("@/lib/server/memory/indexStore", () => ({
  deleteConversationFromMemoryIndex: vi.fn(),
}));

const tempDirs: string[] = [];
const originalEnabled = process.env.MEMORY_V2_ENABLED;
const originalPath = process.env.MEMORY_V2_DATABASE_PATH;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.MEMORY_V2_ENABLED;
  else process.env.MEMORY_V2_ENABLED = originalEnabled;
  if (originalPath === undefined) delete process.env.MEMORY_V2_DATABASE_PATH;
  else process.env.MEMORY_V2_DATABASE_PATH = originalPath;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("conversation storage authority", () => {
  it("uses only SQLite when MEMORY_V2_ENABLED is true", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gaucho-memory-v2-adapter-"));
    tempDirs.push(directory);
    process.env.MEMORY_V2_ENABLED = "true";
    process.env.MEMORY_V2_DATABASE_PATH = join(directory, "memory.sqlite");
    const data = await import("./data");

    const created = await data.createConversation("Somente SQLite");
    const listed = await data.listConversations({ lifecycle: "active" });

    expect(listed).toEqual([created]);
    expect(readDataFileMock).not.toHaveBeenCalled();
    expect(writeDataFileMock).not.toHaveBeenCalled();
    expect(withDataFileLockMock).not.toHaveBeenCalled();
  });

  it("keeps legacy JSON as the sole authority while the flag is disabled", async () => {
    delete process.env.MEMORY_V2_ENABLED;
    const now = "2026-08-31T12:00:00.000Z";
    readDataFileMock.mockResolvedValueOnce([
      {
        id: "legacy-1",
        title: "Legado",
        messages: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const data = await import("./data");

    const listed = await data.listConversations({ lifecycle: "active" });

    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: "legacy-1", title: "Legado" });
    expect(readDataFileMock).toHaveBeenCalledOnce();
  });

  it("patches messages under the file lock so a concurrent autosave is not lost (B6)", async () => {
    delete process.env.MEMORY_V2_ENABLED;
    const now = "2026-09-05T03:00:00.000Z";
    let stored: unknown[] = [
      {
        id: "conv-1",
        title: "Teste",
        createdAt: now,
        updatedAt: now,
        messages: [
          { id: "u1", role: "user", content: "oi", timestamp: now },
          { id: "a1", role: "assistant", content: "Processando", timestamp: now, streamStatus: "streaming" },
        ],
      },
    ];
    readDataFileMock.mockImplementation(async () => structuredClone(stored));
    writeDataFileMock.mockImplementation(async (_file: string, value: unknown[]) => {
      stored = structuredClone(value);
    });
    let chain: Promise<unknown> = Promise.resolve();
    withDataFileLockMock.mockImplementation((_file: string, fn: () => Promise<unknown>) => {
      const next = chain.then(fn, fn);
      chain = next.catch(() => undefined);
      return next;
    });
    const data = await import("./data");

    const autosave = data.updateConversation("conv-1", {
      messages: [
        { id: "u1", role: "user", content: "oi", timestamp: new Date(now) },
        { id: "a1", role: "assistant", content: "Processando", timestamp: new Date(now), streamStatus: "streaming" },
        { id: "u2", role: "user", content: "segunda pergunta", timestamp: new Date(now) },
      ],
    });
    const patched = data.patchConversationMessages("conv-1", (messages) =>
      messages.map((message) =>
        message.id === "a1"
          ? { ...message, content: "Resposta pronta", streamStatus: "completed" as const }
          : message
      )
    );
    await Promise.all([autosave, patched]);

    const final = await data.getConversation("conv-1");
    expect(final?.messages.map((message) => message.id)).toEqual(["u1", "a1", "u2"]);
    expect(final?.messages[1]).toMatchObject({ content: "Resposta pronta", streamStatus: "completed" });
  });

  it("patchConversationMessages returns undefined when the mutator declines", async () => {
    delete process.env.MEMORY_V2_ENABLED;
    readDataFileMock.mockResolvedValue([]);
    withDataFileLockMock.mockImplementation((_file: string, fn: () => Promise<unknown>) => fn());
    const data = await import("./data");
    expect(await data.patchConversationMessages("missing", (messages) => messages)).toBeUndefined();
    expect(writeDataFileMock).not.toHaveBeenCalled();
  });
});
