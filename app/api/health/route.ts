import { NextResponse } from "next/server";
import { readDataFile } from "@/lib/server/jsonFileStore";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: CheckResult;
    openai: CheckResult;
    memory: CheckResult;
  };
  metadata: {
    basePath: string;
    port: string | number;
    node_version: string;
    pid: number;
  };
}

interface CheckResult {
  status: "ok" | "error" | "warning";
  message?: string;
  latency?: number;
  details?: Record<string, boolean | number | string>;
}

async function checkStorage(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const [conversations, memories, persona] = await Promise.all([
      readDataFile("conversations.json", [] as unknown[]),
      readDataFile("memories.json", [] as unknown[]),
      readDataFile("persona.json", {
        id: "default",
        contextAboutUser: "",
        responsePreferences: "",
      }),
    ]);

    return {
      status: "ok",
      message: "Storage accessible",
      latency: Date.now() - start,
      details: {
        conversations: Array.isArray(conversations) ? conversations.length : 0,
        memories: Array.isArray(memories) ? memories.length : 0,
        hasPersona:
          !!persona &&
          typeof persona === "object" &&
          "contextAboutUser" in persona,
      },
    };
  } catch {
    return {
      status: "warning",
      message: "Storage check failed",
      latency: Date.now() - start,
    };
  }
}

async function checkOpenAI(): Promise<CheckResult> {
  const start = Date.now();
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        status: "error",
        message: "OpenAI API key not configured",
      };
    }

    if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
      return {
        status: "warning",
        message: "Invalid API key format",
      };
    }

    return {
      status: "ok",
      message: "API key configured",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "OpenAI check failed",
      latency: Date.now() - start,
    };
  }
}

function checkMemory(): CheckResult {
  try {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    const status = heapUsedMB > 500 ? "warning" : "ok";
    const message = heapUsedMB > 500 ? "High memory usage detected" : "Memory usage normal";

    return {
      status,
      message,
      details: {
        heapUsedMB,
        heapTotalMB,
        rssMB,
        externalMB: Math.round(usage.external / 1024 / 1024),
        heapPercentage: Math.round((heapUsedMB / heapTotalMB) * 100),
      },
    };
  } catch {
    return {
      status: "error",
      message: "Failed to check memory",
    };
  }
}

export async function GET() {
  try {
    const [database, openai] = await Promise.all([
      checkStorage(),
      checkOpenAI(),
    ]);

    const memory = checkMemory();

    const checks = { database, openai, memory };
    const checkValues = Object.values(checks);

    const hasError = checkValues.some(c => c.status === "error");
    const hasWarning = checkValues.some(c => c.status === "warning");

    const overallStatus = hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy";

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: "Gaucho Chat",
      version: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: Math.round(process.uptime()),
      checks,
      metadata: {
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "/",
        port: process.env.PORT || 3000,
        node_version: process.version,
        pid: process.pid,
      },
    };

    const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

    return NextResponse.json(health, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": overallStatus,
      },
    });
  } catch (error) {
    console.error("[Health] Check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        service: "Gaucho Chat",
        error: error instanceof Error ? error.message : "Health check failed",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Health-Status": "unhealthy",
        },
      }
    );
  }
}
