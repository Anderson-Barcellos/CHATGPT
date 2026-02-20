/**
 * Next.js Middleware
 *
 * Runs on Edge runtime before requests reach API routes or pages.
 * Handles:
 * - Rate limiting
 * - API key validation
 * - Security headers
 * - Request logging
 * - CORS preflight
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, addRateLimitHeaders, getUserIdentifier } from '@/lib/security/rateLimit';

// Paths that should be rate limited
const RATE_LIMITED_PATHS = [
  '/api/chat',
  '/api/canvas',
  '/api/images',
];

// Paths that require API key authentication (if enabled)
const API_KEY_PROTECTED_PATHS = [
  '/api/chat',
  '/api/canvas',
  '/api/images',
];

// Public paths that bypass all checks
const PUBLIC_PATHS = [
  '/api/health',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/static',
];

/**
 * Check if API key authentication is enabled and valid
 */
function validateApiKey(request: NextRequest): boolean {
  // Skip if API key auth is not enabled
  if (process.env.API_KEY_AUTH_ENABLED !== 'true') {
    return true;
  }

  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    return false;
  }

  const validKeys = process.env.API_KEYS?.split(',').map(k => k.trim()) || [];

  return validKeys.includes(apiKey);
}

/**
 * Check if path should be protected
 */
function isProtectedPath(pathname: string, protectedPaths: string[]): boolean {
  return protectedPaths.some(path => pathname.startsWith(path));
}

/**
 * Check if path is public (no checks needed)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)
  );
}

/**
 * Log request details (respecting privacy)
 */
function logRequest(request: NextRequest, metadata?: Record<string, any>): void {
  if (process.env.ENABLE_REQUEST_LOGGING !== 'true') {
    return;
  }

  const log = {
    timestamp: new Date().toISOString(),
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get('user-agent')?.substring(0, 100),
    identifier: getUserIdentifier(request),
    ...metadata,
  };

  // In production, send to logging service (e.g., Axiom, Datadog, CloudWatch)
  if (process.env.LOG_FORMAT === 'json') {
    console.log(JSON.stringify(log));
  } else {
    console.log(
      `[${log.timestamp}] ${log.method} ${log.path} - ${log.identifier}`,
      metadata ? JSON.stringify(metadata) : ''
    );
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://vercel.live wss://*.pusher.com",
    "frame-src 'self' https://vercel.live",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  headers.set('Content-Security-Policy', csp);

  // Other security headers (some are also in vercel.json, but redundancy is okay)
  headers.set('X-DNS-Prefetch-Control', 'on');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  return response;
}

/**
 * Handle CORS preflight requests
 */
function handleCorsPrelight(request: NextRequest): NextResponse | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ];

  // Check if origin is allowed
  const isAllowed = origin && allowedOrigins.includes(origin);

  const response = new NextResponse(null, { status: 204 });

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Api-Key'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(request);
  if (corsResponse) {
    return corsResponse;
  }

  // API key validation (if enabled and path is protected)
  if (isProtectedPath(pathname, API_KEY_PROTECTED_PATHS)) {
    const isValidApiKey = validateApiKey(request);

    if (!isValidApiKey) {
      logRequest(request, { reason: 'invalid_api_key', blocked: true });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Valid API key required. Include X-Api-Key header.',
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'ApiKey',
          },
        }
      );
    }
  }

  // Rate limiting
  if (isProtectedPath(pathname, RATE_LIMITED_PATHS)) {
    const rateLimitResult = await checkRateLimit(request, pathname);

    if (!rateLimitResult.allowed) {
      logRequest(request, {
        reason: 'rate_limited',
        blocked: true,
        limit: rateLimitResult.limit,
        current: rateLimitResult.current,
        retryAfter: rateLimitResult.retryAfter,
      });

      const response = NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
          limit: rateLimitResult.limit,
        },
        { status: 429 }
      );

      addRateLimitHeaders(response.headers, rateLimitResult, pathname);

      return response;
    }

    // Add rate limit info to successful requests
    const response = NextResponse.next();
    addRateLimitHeaders(response.headers, rateLimitResult, pathname);

    // Log successful API requests
    logRequest(request, { rateLimited: false });

    return addSecurityHeaders(response);
  }

  // Add security headers to all other requests
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

/**
 * Configure which paths the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
