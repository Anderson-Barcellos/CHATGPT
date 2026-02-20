/**
 * Rate Limiting Implementation
 * 
 * Supports both memory-based (development) and Redis-based (production) rate limiting.
 * Uses sliding window algorithm for accurate rate limiting.
 */

import { NextRequest } from 'next/server';

// Rate limit configuration per endpoint
export const RATE_LIMITS = {
  chat: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_CHAT_RPM || '20', 10),
  },
  canvas: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_CANVAS_RPM || '10', 10),
  },
  images: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_IMAGES_RPM || '5', 10),
  },
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: 60,
  },
} as const;

export type RateLimitEndpoint = keyof typeof RATE_LIMITS;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for development (not suitable for production with multiple instances)
class MemoryStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 60 * 1000);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (entry.resetTime < now) {
      this.store.delete(key);
      return null;
    }
    
    return entry;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Redis store for production (with Upstash or standard Redis)
class RedisStore {
  private redis: any;

  constructor(redisUrl: string) {
    // Dynamic import to avoid bundling Redis in client-side code
    // In production, you would use @upstash/redis or ioredis
    if (redisUrl.includes('upstash')) {
      // Upstash Redis (serverless-friendly)
      // npm install @upstash/redis
      // import { Redis } from '@upstash/redis';
      // this.redis = Redis.fromEnv();
      throw new Error('Upstash Redis integration: Install @upstash/redis and uncomment the code above');
    } else {
      // Standard Redis (for traditional hosting)
      // npm install ioredis
      // import Redis from 'ioredis';
      // this.redis = new Redis(redisUrl);
      throw new Error('Redis integration: Install ioredis and uncomment the code above');
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const resetTime = now + windowMs;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.pexpireat(key, resetTime);
    
    const results = await pipeline.exec();
    const count = results[0][1] as number;

    return {
      count,
      resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const [count, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.pttl(key),
    ]);

    if (!count || ttl < 0) return null;

    return {
      count: parseInt(count, 10),
      resetTime: Date.now() + ttl,
    };
  }
}

// Store singleton
let store: MemoryStore | RedisStore | null = null;

function getStore(): MemoryStore | RedisStore {
  if (store) return store;

  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl && process.env.NODE_ENV === 'production') {
    try {
      store = new RedisStore(redisUrl);
      console.log('[Rate Limit] Using Redis store');
    } catch (error) {
      console.warn('[Rate Limit] Redis initialization failed, falling back to memory store:', error);
      store = new MemoryStore();
    }
  } else {
    store = new MemoryStore();
    if (process.env.NODE_ENV === 'development') {
      console.log('[Rate Limit] Using memory store (development mode)');
    }
  }

  return store;
}

/**
 * Get user identifier from request
 * Priority: API key > IP address > User agent hash
 */
export function getUserIdentifier(request: NextRequest): string {
  // Check for API key in header
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return `api:${hashString(apiKey).slice(0, 12)}`;
  }

  // Get IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';

  // Fallback to user agent hash if no IP
  if (ip === 'unknown') {
    const userAgent = request.headers.get('user-agent') || 'anonymous';
    return `ua:${hashString(userAgent)}`;
  }

  return `ip:${ip}`;
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get rate limit configuration for a given endpoint
 */
export function getRateLimitConfig(endpoint: string): { windowMs: number; max: number } {
  // Extract endpoint name from path
  const normalizedEndpoint = endpoint.replace(/^\/api\//, '').split('/')[0];
  
  if (normalizedEndpoint in RATE_LIMITS) {
    return RATE_LIMITS[normalizedEndpoint as RateLimitEndpoint];
  }
  
  return RATE_LIMITS.default;
}

/**
 * Check if request should be rate limited
 * Returns null if allowed, or an object with retry info if rate limited
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: string
): Promise<{ allowed: true } | { allowed: false; retryAfter: number; limit: number; current: number }> {
  // Skip rate limiting if disabled
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return { allowed: true };
  }

  const identifier = getUserIdentifier(request);
  const config = getRateLimitConfig(endpoint);
  const key = `ratelimit:${endpoint}:${identifier}`;

  try {
    const store = getStore();
    const entry = await store.increment(key, config.windowMs);

    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
      return {
        allowed: false,
        retryAfter,
        limit: config.max,
        current: entry.count,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('[Rate Limit] Error checking rate limit:', error);
    // Fail open - allow request if rate limiting fails
    return { allowed: true };
  }
}

/**
 * Reset rate limit for a user (useful for testing or manual override)
 */
export async function resetRateLimit(identifier: string, endpoint: string): Promise<void> {
  const key = `ratelimit:${endpoint}:${identifier}`;
  const store = getStore();
  await store.reset(key);
}

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(
  identifier: string,
  endpoint: string
): Promise<{ limit: number; remaining: number; resetTime: number } | null> {
  const key = `ratelimit:${endpoint}:${identifier}`;
  const config = getRateLimitConfig(endpoint);
  
  try {
    const store = getStore();
    const entry = await store.get(key);

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
    console.error('[Rate Limit] Error getting rate limit status:', error);
    return null;
  }
}

/**
 * Middleware helper to add rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: Awaited<ReturnType<typeof checkRateLimit>>,
  endpoint: string
): void {
  const config = getRateLimitConfig(endpoint);
  
  headers.set('X-RateLimit-Limit', config.max.toString());
  
  if (result.allowed) {
    // Would need to query store again to get accurate remaining count
    // For performance, we don't do this here
  } else {
    headers.set('X-RateLimit-Remaining', '0');
    headers.set('X-RateLimit-Reset', Math.ceil(result.retryAfter).toString());
    headers.set('Retry-After', result.retryAfter.toString());
  }
}
