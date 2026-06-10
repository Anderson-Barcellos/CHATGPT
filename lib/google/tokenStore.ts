import { promises as fs } from "fs";
import path from "path";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_NAME = "google-calendar-token.json";
const TOKEN_FILE_PATH = path.join(DATA_DIR, FILE_NAME);
const TOKEN_STORE_VERSION = 1;

export interface GoogleOAuthTokenSet {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface GoogleCalendarToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
  connectedAt: string;
  updatedAt: string;
}

interface EncryptedGoogleCalendarToken {
  version: number;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface GoogleCalendarConnectionStatus {
  connected: boolean;
  tokenStoreConfigured: boolean;
  hasRefreshToken: boolean;
  expiresAt?: string;
  scope?: string;
  tokenType?: string;
  defaultCalendarId: string;
  error?: string;
}

export function deriveGoogleTokenEncryptionKey(secret: string): Buffer {
  const trimmed = secret.trim();

  if (!trimmed) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY vazio.");
  }

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;

  const hex = Buffer.from(trimmed, "hex");
  if (hex.length === 32) return hex;

  return createHash("sha256").update(trimmed).digest();
}

function getEncryptionKey(): Buffer | null {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret?.trim()) return null;
  return deriveGoogleTokenEncryptionKey(secret);
}

function requireEncryptionKey(): Buffer {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY precisa estar configurada.");
  }
  return key;
}

export function isGoogleTokenStoreConfigured(): boolean {
  try {
    return getEncryptionKey() !== null;
  } catch {
    return false;
  }
}

export function encryptTokenValue(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptTokenValue(payload: string, key: Buffer): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Formato de token criptografado invalido.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function readEncryptedRecord(): Promise<EncryptedGoogleCalendarToken | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<EncryptedGoogleCalendarToken>;

    if (
      parsed.version !== TOKEN_STORE_VERSION ||
      typeof parsed.encryptedAccessToken !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.connectedAt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return parsed as EncryptedGoogleCalendarToken;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeEncryptedRecord(
  record: EncryptedGoogleCalendarToken
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${TOKEN_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(record, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(tempPath, 0o600);
  await fs.rename(tempPath, TOKEN_FILE_PATH);
  await fs.chmod(TOKEN_FILE_PATH, 0o600);
}

export async function readGoogleCalendarToken(): Promise<GoogleCalendarToken | null> {
  const encrypted = await readEncryptedRecord();
  if (!encrypted) return null;

  const key = requireEncryptionKey();
  return {
    accessToken: decryptTokenValue(encrypted.encryptedAccessToken, key),
    ...(encrypted.encryptedRefreshToken
      ? { refreshToken: decryptTokenValue(encrypted.encryptedRefreshToken, key) }
      : {}),
    expiresAt: encrypted.expiresAt,
    ...(encrypted.scope ? { scope: encrypted.scope } : {}),
    ...(encrypted.tokenType ? { tokenType: encrypted.tokenType } : {}),
    connectedAt: encrypted.connectedAt,
    updatedAt: encrypted.updatedAt,
  };
}

export async function saveGoogleCalendarToken(
  tokenSet: GoogleOAuthTokenSet
): Promise<GoogleCalendarToken> {
  const key = requireEncryptionKey();
  const previous = await readGoogleCalendarToken().catch(() => null);
  const accessToken = tokenSet.access_token || previous?.accessToken;
  const refreshToken = tokenSet.refresh_token || previous?.refreshToken;

  if (!accessToken) {
    throw new Error("Google OAuth nao retornou access_token.");
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.max(tokenSet.expires_in ?? 3600, 1) * 1000
  ).toISOString();
  const connectedAt = previous?.connectedAt || now.toISOString();
  const updatedAt = now.toISOString();

  const record: EncryptedGoogleCalendarToken = {
    version: TOKEN_STORE_VERSION,
    encryptedAccessToken: encryptTokenValue(accessToken, key),
    ...(refreshToken
      ? { encryptedRefreshToken: encryptTokenValue(refreshToken, key) }
      : {}),
    expiresAt,
    ...(tokenSet.scope || previous?.scope
      ? { scope: tokenSet.scope || previous?.scope }
      : {}),
    ...(tokenSet.token_type || previous?.tokenType
      ? { tokenType: tokenSet.token_type || previous?.tokenType }
      : {}),
    connectedAt,
    updatedAt,
  };

  await writeEncryptedRecord(record);

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt,
    ...(record.scope ? { scope: record.scope } : {}),
    ...(record.tokenType ? { tokenType: record.tokenType } : {}),
    connectedAt,
    updatedAt,
  };
}

export async function clearGoogleCalendarToken(): Promise<void> {
  await fs.rm(TOKEN_FILE_PATH, { force: true });
}

export async function getGoogleCalendarConnectionStatus(
  defaultCalendarId: string
): Promise<GoogleCalendarConnectionStatus> {
  const tokenStoreConfigured = isGoogleTokenStoreConfigured();
  const encrypted = await readEncryptedRecord();

  if (!encrypted) {
    return {
      connected: false,
      tokenStoreConfigured,
      hasRefreshToken: false,
      defaultCalendarId,
    };
  }

  if (!tokenStoreConfigured) {
    return {
      connected: false,
      tokenStoreConfigured,
      hasRefreshToken: Boolean(encrypted.encryptedRefreshToken),
      defaultCalendarId,
      error: "Token salvo, mas GOOGLE_TOKEN_ENCRYPTION_KEY nao esta configurada.",
    };
  }

  try {
    const token = await readGoogleCalendarToken();
    return {
      connected: Boolean(token),
      tokenStoreConfigured,
      hasRefreshToken: Boolean(token?.refreshToken),
      ...(token?.expiresAt ? { expiresAt: token.expiresAt } : {}),
      ...(token?.scope ? { scope: token.scope } : {}),
      ...(token?.tokenType ? { tokenType: token.tokenType } : {}),
      defaultCalendarId,
    };
  } catch {
    return {
      connected: false,
      tokenStoreConfigured,
      hasRefreshToken: Boolean(encrypted.encryptedRefreshToken),
      defaultCalendarId,
      error: "Token salvo nao pode ser descriptografado. Reconecte o Google.",
    };
  }
}
