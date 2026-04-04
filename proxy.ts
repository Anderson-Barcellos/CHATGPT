import { NextRequest, NextResponse } from "next/server";
import { addRateLimitHeaders, checkRateLimit } from "@/lib/security/rateLimit";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const RATE_LIMITED_PATHS = ["/api/chat", "/api/transcribe"];
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/check",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
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

function isRateLimitedPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((path) => pathname.startsWith(path));
}

function buildLoginUrl(request: NextRequest): URL {
  return new URL(`${BASE_PATH}/login`, request.url);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = response.headers;
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://vercel.live https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://vercel.live",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

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

export async function proxy(request: NextRequest) {
  const pathname = stripBasePath(request.nextUrl.pathname);

  if (pathname === "/login" && isAuthEnabled()) {
    const authenticated = await isAuthenticatedRequest(request);
    if (authenticated) {
      return NextResponse.redirect(new URL(`${BASE_PATH}/`, request.url));
    }
  }

  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (isAuthEnabled()) {
    const authenticated = await isAuthenticatedRequest(request);

    if (!authenticated) {
      if (pathname.startsWith("/api/")) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: "Unauthorized", message: "Faça login para continuar." },
            { status: 401 }
          )
        );
      }

      return addSecurityHeaders(NextResponse.redirect(buildLoginUrl(request)));
    }
  }

  if (isRateLimitedPath(pathname)) {
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
      return addSecurityHeaders(response);
    }

    const response = NextResponse.next();
    addRateLimitHeaders(response.headers, rateLimitResult, pathname);
    return addSecurityHeaders(response);
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|eot|map)$).*)",
  ],
};
