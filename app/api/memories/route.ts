import { NextRequest, NextResponse } from "next/server";
import { createMemory, listMemories } from "./data";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { serializeMemory } from "@/lib/storage/serializers";
import { MEMORY_CATEGORIES } from "@/types";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized", message: "Faça login para continuar." },
    { status: 401 }
  );
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const memories = await listMemories();
  return NextResponse.json(memories.map((memory) => serializeMemory(memory)));
}

export async function POST(request: NextRequest) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const body = await request.json();

    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { error: "content must be a non-empty string" },
        { status: 400 }
      );
    }

    if (
      typeof body.category !== "string" ||
      !(body.category in MEMORY_CATEGORIES)
    ) {
      return NextResponse.json(
        { error: "category must be a valid memory category" },
        { status: 400 }
      );
    }

    const memory = await createMemory({
      content: body.content.trim(),
      category: body.category,
      isActive: Boolean(body.isActive),
      priority: Number.isFinite(body.priority) ? body.priority : 0,
    });

    return NextResponse.json(serializeMemory(memory), { status: 201 });
  } catch (error) {
    console.error("[memories] POST error", error);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}
