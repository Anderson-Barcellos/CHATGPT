import { createHash } from "node:crypto";
import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { checkHealthStorage } from "./healthStorage";

const directories: string[] = [];

async function createStorageFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gaucho-health-storage-"));
  directories.push(directory);
  await writeFile(path.join(directory, "conversations.json"), "[]", "utf-8");
  await writeFile(path.join(directory, "memories.json"), "[]", "utf-8");
  await writeFile(
    path.join(directory, "persona.json"),
    JSON.stringify({ contextAboutUser: "", responsePreferences: "" }),
    "utf-8"
  );
  return directory;
}

async function snapshot(directory: string) {
  const names = await readdir(directory);
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        createHash("sha256").update(await readFile(path.join(directory, name))).digest("hex"),
      ])
    )
  );
}

afterEach(async () => {
  while (directories.length > 0) {
    await rm(directories.pop()!, { recursive: true, force: true });
  }
});

describe("checkHealthStorage", () => {
  it("lê JSON válido sem criar, recuperar, renomear ou alterar arquivos", async () => {
    const directory = await createStorageFixture();
    const before = await snapshot(directory);

    const result = await checkHealthStorage({ dataDirectory: directory, memoryV2Enabled: false });

    expect(result).toMatchObject({
      status: "ok",
      details: { conversations: 0, memories: 0, hasPersona: true },
    });
    expect(await snapshot(directory)).toEqual(before);
  });

  it("falha para storage ausente, JSON corrompido ou formato incompatível sem recovery", async () => {
    const directory = await createStorageFixture();
    await rm(path.join(directory, "conversations.json"));
    expect(await checkHealthStorage({ dataDirectory: directory, memoryV2Enabled: false })).toMatchObject({ status: "error" });
    expect(await readdir(directory)).not.toContain("conversations.json");

    await writeFile(path.join(directory, "conversations.json"), "{ truncado", "utf-8");
    expect(await checkHealthStorage({ dataDirectory: directory, memoryV2Enabled: false })).toMatchObject({ status: "error" });
    expect(await readdir(directory)).not.toContain("conversations.json.corrupt-1");

    await writeFile(path.join(directory, "conversations.json"), "{}", "utf-8");
    expect(await checkHealthStorage({ dataDirectory: directory, memoryV2Enabled: false })).toMatchObject({ status: "error" });
  });

  it("falha para arquivo sem permissão de leitura", async () => {
    const directory = await createStorageFixture();
    const file = path.join(directory, "memories.json");
    await chmod(file, 0o000);

    expect(await checkHealthStorage({ dataDirectory: directory, memoryV2Enabled: false })).toMatchObject({ status: "error" });
  });

  it("consulta a autoridade SQLite em modo readonly quando Memory V2 está ativa", async () => {
    const directory = await createStorageFixture();
    const databasePath = path.join(directory, "memory-v2.sqlite");
    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.exec("CREATE TABLE conversations (id TEXT PRIMARY KEY); INSERT INTO conversations (id) VALUES ('conv-1')");
    const before = await snapshot(directory);

    try {
      const result = await checkHealthStorage({
        dataDirectory: directory,
        memoryV2Enabled: true,
        memoryV2DatabasePath: databasePath,
      });

      expect(result).toMatchObject({ status: "ok", details: { conversations: 1 } });
      expect(await snapshot(directory)).toEqual(before);
    } finally {
      database.close();
    }
  });

  it("falha se a autoridade SQLite selecionada não existe", async () => {
    const directory = await createStorageFixture();

    expect(
      await checkHealthStorage({
        dataDirectory: directory,
        memoryV2Enabled: true,
        memoryV2DatabasePath: path.join(directory, "ausente.sqlite"),
      })
    ).toMatchObject({ status: "error" });
  });

  it("falha para SQLite sem permissão de leitura sem criar arquivos auxiliares", async () => {
    const directory = await createStorageFixture();
    const databasePath = path.join(directory, "memory-v2.sqlite");
    const database = new Database(databasePath);
    database.exec("CREATE TABLE conversations (id TEXT PRIMARY KEY)");
    database.close();
    await chmod(databasePath, 0o000);
    const before = await readdir(directory);

    expect(
      await checkHealthStorage({
        dataDirectory: directory,
        memoryV2Enabled: true,
        memoryV2DatabasePath: databasePath,
      })
    ).toMatchObject({ status: "error" });
    expect(await readdir(directory)).toEqual(before);
  });
});
