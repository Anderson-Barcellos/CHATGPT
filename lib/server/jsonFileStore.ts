import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const lockChains = new Map<string, Promise<void>>();

function resolveDataFile(fileName: string): string {
  return path.join(DATA_DIR, fileName);
}

async function writeFileAtomic<T>(filePath: string, value: T): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function ensureDataFile<T>(filePath: string, defaultValue: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await writeFileAtomic(filePath, defaultValue);
  }
}

async function preserveCorruptFile(filePath: string): Promise<void> {
  const corruptPath = `${filePath}.corrupt-${Date.now()}`;

  try {
    await fs.rename(filePath, corruptPath);
    console.error(
      `[jsonFileStore] JSON corrompido preservado em ${corruptPath}; usando valor default.`
    );
  } catch (error) {
    console.error(
      `[jsonFileStore] JSON corrompido em ${filePath} e falha ao preservar copia:`,
      error
    );
  }
}

export async function readDataFile<T>(fileName: string, defaultValue: T): Promise<T> {
  const filePath = resolveDataFile(fileName);
  await ensureDataFile(filePath, defaultValue);

  const raw = await fs.readFile(filePath, "utf-8");

  try {
    return JSON.parse(raw) as T;
  } catch {
    await preserveCorruptFile(filePath);
    return defaultValue;
  }
}

export async function writeDataFile<T>(fileName: string, value: T): Promise<void> {
  const filePath = resolveDataFile(fileName);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await writeFileAtomic(filePath, value);
}

export async function withDataFileLock<T>(
  fileName: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = resolveDataFile(fileName);
  const previous = lockChains.get(key) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = previous.then(() => current);
  lockChains.set(key, next);

  await previous;

  try {
    return await fn();
  } finally {
    release();

    if (lockChains.get(key) === next) {
      lockChains.delete(key);
    }
  }
}
