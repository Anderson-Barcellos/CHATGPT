import type { NextConfig } from "next";

const isDesktopBuild = process.env.GAUCHO_DESKTOP_BUILD === "true";
const desktopTraceExcludes = [
  "./.env*",
  "./data/**",
  "./docs/**",
  "./.git/**",
  "./.worktrees/**",
  "./out/**",
  "./desktop/.next/**",
  "./.vite/**",
];

const nextConfig: NextConfig = {
  // A compilação desktop é produzida em uma worktree isolada e inicia apenas
  // em loopback. A build web mantém seu output e basePath atuais.
  output: isDesktopBuild ? "standalone" : undefined,
  // O NFT atual do Studio pode alcançar a raiz do projeto. Dados runtime e
  // segredos jamais podem atravessar para o recurso standalone do desktop.
  outputFileTracingExcludes: isDesktopBuild ? { "/*": desktopTraceExcludes } : undefined,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  reactStrictMode: true,

  poweredByHeader: false,

  compress: true,

  serverExternalPackages: ["@lancedb/lancedb", "better-sqlite3"],

  turbopack: {
    root: __dirname,
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "react-syntax-highlighter",
      "@tanstack/react-query",
    ],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.openai.com",
      },
      {
        protocol: "https",
        hostname: "ultrassom.ai",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
