import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let tempRoot: string;
let dataDir: string;
let store: typeof import("./jsonFileStore");

beforeAll(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jsonfilestore-"));
  dataDir = path.join(tempRoot, "data");
  vi.spyOn(process, "cwd").mockReturnValue(tempRoot);
  vi.resetModules();
  store = await import("./jsonFileStore");
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("writeDataFile", () => {
  it("persiste o valor e nao deixa arquivo temporario orfao, mesmo com tmp de crash anterior", async () => {
    const fileName = "write-atomic.json";
    const tmpPath = path.join(dataDir, `${fileName}.tmp`);

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(tmpPath, "{ lixo truncado de um crash", "utf-8");

    await store.writeDataFile(fileName, { valor: 42 });

    const raw = await fs.readFile(path.join(dataDir, fileName), "utf-8");
    expect(JSON.parse(raw)).toEqual({ valor: 42 });
    await expect(fs.access(tmpPath)).rejects.toThrow();
  });
});

describe("readDataFile", () => {
  it("faz roundtrip de escrita e leitura", async () => {
    await store.writeDataFile("roundtrip.json", [{ id: "a" }]);

    const value = await store.readDataFile("roundtrip.json", [] as unknown[]);

    expect(value).toEqual([{ id: "a" }]);
  });

  it("preserva arquivo corrompido como .corrupt-* e devolve o default", async () => {
    const fileName = "broken.json";
    const filePath = path.join(dataDir, fileName);
    const corruptedContent = '[{"id": "conversa-importante", "mess';

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, corruptedContent, "utf-8");

    const value = await store.readDataFile(fileName, ["default"]);

    expect(value).toEqual(["default"]);

    const siblings = await fs.readdir(dataDir);
    const corruptCopies = siblings.filter((name) =>
      name.startsWith(`${fileName}.corrupt-`)
    );
    expect(corruptCopies).toHaveLength(1);

    const preserved = await fs.readFile(
      path.join(dataDir, corruptCopies[0]),
      "utf-8"
    );
    expect(preserved).toBe(corruptedContent);
  });

  it("nao deixa a proxima gravacao destruir a copia preservada", async () => {
    const fileName = "broken-then-write.json";
    const filePath = path.join(dataDir, fileName);

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, "nem de longe json", "utf-8");

    await store.readDataFile(fileName, [] as unknown[]);
    await store.writeDataFile(fileName, [{ id: "novo" }]);

    const siblings = await fs.readdir(dataDir);
    const corruptCopies = siblings.filter((name) =>
      name.startsWith(`${fileName}.corrupt-`)
    );
    expect(corruptCopies).toHaveLength(1);

    const preserved = await fs.readFile(
      path.join(dataDir, corruptCopies[0]),
      "utf-8"
    );
    expect(preserved).toBe("nem de longe json");
  });
});
