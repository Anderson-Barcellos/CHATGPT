import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

export interface HealthStorageCheck {
  status: "ok" | "error";
  message: string;
  details?: {
    conversations: number;
    memories: number;
    hasPersona: boolean;
  };
}

export interface HealthStorageOptions {
  dataDirectory?: string;
  memoryV2Enabled?: boolean;
  memoryV2DatabasePath?: string;
}

function dataDirectory(options: HealthStorageOptions): string {
  return options.dataDirectory ?? path.join(process.cwd(), "data");
}

function assertReadableRegularFile(stats: Awaited<ReturnType<typeof fs.stat>>): void {
  if (!stats.isFile()) {
    throw new Error("storage entry is not a regular file");
  }

  if ((Number(stats.mode) & 0o444) === 0) {
    throw new Error("storage entry has no read permission");
  }
}

async function readStrictJson(
  directory: string,
  fileName: string
): Promise<unknown> {
  const filePath = path.join(directory, fileName);
  const stats = await fs.stat(filePath);
  assertReadableRegularFile(stats);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
}

async function readStrictJsonArray(directory: string, fileName: string): Promise<unknown[]> {
  const value = await readStrictJson(directory, fileName);
  if (!Array.isArray(value)) {
    throw new Error("storage JSON has an incompatible format");
  }
  return value;
}

async function readStrictPersona(directory: string): Promise<Record<string, unknown>> {
  const value = await readStrictJson(directory, "persona.json");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("persona JSON has an incompatible format");
  }
  return value as Record<string, unknown>;
}

async function checkReadonlyConversationDatabase(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  assertReadableRegularFile(stats);
  const snapshotDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "gaucho-health-sqlite-"));
  const snapshotPath = path.join(snapshotDirectory, "memory-v2.sqlite");
  try {
    // SQLite readonly ainda atualiza o -shm de uma base em WAL. A cópia efêmera
    // inclui o WAL para observar o estado atual, mantendo a autoridade intacta.
    await fs.copyFile(filePath, snapshotPath);
    try {
      await fs.copyFile(`${filePath}-wal`, `${snapshotPath}-wal`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const database = new Database(snapshotPath, { readonly: true, fileMustExist: true });
    try {
      const result = database
        .prepare("SELECT COUNT(*) AS count FROM conversations")
        .get() as { count: number | bigint };
      return Number(result.count);
    } finally {
      database.close();
    }
  } finally {
    await fs.rm(snapshotDirectory, { recursive: true, force: true });
  }
}

/**
 * Readiness só observa as autoridades de armazenamento. Ela não usa o store
 * normal porque ele cria arquivos e recupera JSON corrompido durante leituras.
 */
export async function checkHealthStorage(
  options: HealthStorageOptions = {}
): Promise<HealthStorageCheck> {
  const directory = dataDirectory(options);
  const memoryV2Enabled = options.memoryV2Enabled ?? process.env.MEMORY_V2_ENABLED === "true";

  try {
    const [memories, persona, conversations] = await Promise.all([
      readStrictJsonArray(directory, "memories.json"),
      readStrictPersona(directory),
      memoryV2Enabled
        ? (async () => {
            const databasePath =
              options.memoryV2DatabasePath ??
              process.env.MEMORY_V2_DATABASE_PATH ??
              path.join(directory, "memory-v2.sqlite");
            return checkReadonlyConversationDatabase(databasePath);
          })()
        : readStrictJsonArray(directory, "conversations.json"),
    ]);

    return {
      status: "ok",
      message: "Storage accessible",
      details: {
        conversations: Array.isArray(conversations) ? conversations.length : conversations,
        memories: memories.length,
        hasPersona: "contextAboutUser" in persona,
      },
      // A rota preserva a latência no seu próprio contrato de resposta.
      // Manter a leitura aqui independente impede qualquer efeito de recovery.
    };
  } catch {
    return {
      status: "error",
      message: "Storage check failed",
      details: undefined,
    };
  }
}
