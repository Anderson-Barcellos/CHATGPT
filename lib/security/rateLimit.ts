import { NextRequest } from "next/server";

export const RATE_LIMITS = {
  chat: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_CHAT_RPM || "20", 10),
  },
  studio: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_STUDIO_RPM || "20", 10),
  },
  studioAutocomplete: {
    windowMs: 60 * 1000,
    max: parseInt(
      process.env.RATE_LIMIT_STUDIO_AUTOCOMPLETE_RPM || "180",
      10
    ),
  },
  transcribe: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_TRANSCRIBE_RPM || "10", 10),
  },
  login: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_LOGIN_RPM || "5", 10),
  },
  default: {
    windowMs: 60 * 1000,
    max: 60,
  },
} as const;

type RateLimitEndpoint = keyof typeof RATE_LIMITS;

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

class MemoryStore {
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime <= now) {
          this.store.delete(key);
        }
      }
    }, 60 * 1000);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime <= now) {
      const entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, entry);
      return entry;
    }

    const updated = {
      ...existing,
      count: existing.count + 1,
    };
    this.store.set(key, updated);
    return updated;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const existing = this.store.get(key);
    if (!existing) return null;

    if (existing.resetTime <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const store = new MemoryStore();

function hashString(str: string): string {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    const char = str.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

export function getUserIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");

  if (ip) {
    return `ip:${ip}`;
  }

  const userAgent = request.headers.get("user-agent") || "anonymous";
  return `ua:${hashString(userAgent)}`;
}

export function getRateLimitConfig(endpoint: string): { windowMs: number; max: number } {
  if (endpoint === "/api/auth/login") {
    return RATE_LIMITS.login;
  }

  if (endpoint === "/api/studio/autocomplete") {
    return RATE_LIMITS.studioAutocomplete;
  }

  const normalizedEndpoint = endpoint.replace(/^\/api\//, "").split("/")[0];

  if (normalizedEndpoint in RATE_LIMITS) {
    return RATE_LIMITS[normalizedEndpoint as RateLimitEndpoint];
  }

  return RATE_LIMITS.default;
}

export async function checkRateLimit(
  request: NextRequest,
  endpoint: string
): Promise<
  { allowed: true } | { allowed: false; retryAfter: number; limit: number; current: number }
> {
  if (process.env.RATE_LIMIT_ENABLED === "false") {
    return { allowed: true };
  }

  const identifier = getUserIdentifier(request);
  const config = getRateLimitConfig(endpoint);
  const key = `ratelimit:${endpoint}:${identifier}`;

  try {
    const entry = await store.increment(key, config.windowMs);
    if (entry.count > config.max) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
        limit: config.max,
        current: entry.count,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[Rate Limit] Error checking rate limit:", error);
    return { allowed: true };
  }
}

export async function resetRateLimit(identifier: string, endpoint: string): Promise<void> {
  await store.reset(`ratelimit:${endpoint}:${identifier}`);
}

export async function getRateLimitStatus(
  identifier: string,
  endpoint: string
): Promise<{ limit: number; remaining: number; resetTime: number } | null> {
  try {
    const config = getRateLimitConfig(endpoint);
    const entry = await store.get(`ratelimit:${endpoint}:${identifier}`);

    if (!entry) {
      return {
        limit: config.max,
        remaining: config.max,
        resetTime: Date.now() + config.windowMs,
      };
    }

    return {
      limit: config.max,
      remaining: Math.max(0, config.max - entry.count),
      resetTime: entry.resetTime,
    };
  } catch (error) {
    console.error("[Rate Limit] Error getting rate limit status:", error);
    return null;
  }
}

export function addRateLimitHeaders(
  headers: Headers,
  result: Awaited<ReturnType<typeof checkRateLimit>>,
  endpoint: string
): void {
  const config = getRateLimitConfig(endpoint);
  headers.set("X-RateLimit-Limit", config.max.toString());

  if (!result.allowed) {
    headers.set("X-RateLimit-Remaining", "0");
    headers.set("X-RateLimit-Reset", Math.ceil(result.retryAfter).toString());
    headers.set("Retry-After", result.retryAfter.toString());
  }
}
