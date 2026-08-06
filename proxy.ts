import { NextRequest, NextResponse } from "next/server";
import { addRateLimitHeaders, checkRateLimit } from "@/lib/security/rateLimit";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const RATE_LIMITED_PATHS = [
  "/api/chat",
  "/api/studio/assist",
  "/api/studio/autocomplete",
  "/api/transcribe",
  "/api/auth/login",
  "/api/integrations/google/auth/start",
  "/api/calendar/events",
  "/api/workspace-notes",
];
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/check",
  "/api/health",
  "/api/pulse/run-due",
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
];

function stripBasePath(pathname: string): string {
  if (!BASE_PATH || !pathname.startsWith(BASE_PATH)) {
    return pathname;
  }

  const stripped = pathname.slice(BASE_PATH.length);
  return stripped || "/";
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path)
  );
}

export function shouldRateLimitPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((path) => pathname.startsWith(path));
}

async function applyRateLimit(request: NextRequest, pathname: string) {
  const rateLimitResult = await checkRateLimit(request, pathname);

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
        retryAfter: rateLimitResult.retryAfter,
        limit: rateLimitResult.limit,
      },
      { status: 429 }
    );

    addRateLimitHeaders(response.headers, rateLimitResult, pathname);
    return finalizeResponse(response, pathname);
  }

  const response = NextResponse.next();
  addRateLimitHeaders(response.headers, rateLimitResult, pathname);
  return finalizeResponse(response, pathname);
}

function buildLoginUrl(request: NextRequest): URL {
  return new URL(`${BASE_PATH}/login`, request.url);
}

const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.openai.com https://vercel.live wss:",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const STUDIO_RUNNER_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src blob:",
  "connect-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

export function getSecurityContentSecurityPolicy(pathname: string): string {
  return pathname === "/api/studio/runner"
    ? STUDIO_RUNNER_CONTENT_SECURITY_POLICY
    : APP_CONTENT_SECURITY_POLICY;
}

function addSecurityHeaders(
  response: NextResponse,
  pathname: string
): NextResponse {
  const headers = response.headers;
  const csp = getSecurityContentSecurityPolicy(pathname);

  headers.set("Content-Security-Policy", csp);
  headers.set("X-DNS-Prefetch-Control", "on");
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), interest-cohort=()"
  );

  return response;
}

function finalizeResponse(
  response: NextResponse,
  pathname: string
): NextResponse {
  return addSecurityHeaders(response, pathname);
}

export async function proxy(request: NextRequest) {
  const pathname = stripBasePath(request.nextUrl.pathname);

  if (pathname === "/api/auth/login" && shouldRateLimitPath(pathname)) {
    return applyRateLimit(request, pathname);
  }

  if (isPublicPath(pathname)) {
    return finalizeResponse(NextResponse.next(), pathname);
  }

  if (isAuthEnabled()) {
    const authenticated = await isAuthenticatedRequest(request);

    if (!authenticated) {
      if (pathname.startsWith("/api/")) {
        return finalizeResponse(
          NextResponse.json(
            { error: "Unauthorized", message: "Faça login para continuar." },
            { status: 401 }
          ),
          pathname
        );
      }

      return finalizeResponse(
        NextResponse.redirect(buildLoginUrl(request)),
        pathname
      );
    }
  }

  if (shouldRateLimitPath(pathname)) {
    return applyRateLimit(request, pathname);
  }

  return finalizeResponse(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|map)$).*)",
  ],
};
