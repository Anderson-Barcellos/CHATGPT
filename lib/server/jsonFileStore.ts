import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const lockChains = new Map<string, Promise<void>>();

function resolveDataFile(fileName: string): string {
  return path.join(DATA_DIR, fileName);
}

async function ensureDataFile<T>(filePath: string, defaultValue: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
  }
}

export async function readDataFile<T>(fileName: string, defaultValue: T): Promise<T> {
  const filePath = resolveDataFile(fileName);
  await ensureDataFile(filePath, defaultValue);

  const raw = await fs.readFile(filePath, "utf-8");

  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export async function writeDataFile<T>(fileName: string, value: T): Promise<void> {
  const filePath = resolveDataFile(fileName);
  await ensureDataFile(filePath, value);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
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
