import { NextRequest, NextResponse } from "next/server";
import { deleteMemory, updateMemory } from "../data";
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (
      body.category !== undefined &&
      (typeof body.category !== "string" || !(body.category in MEMORY_CATEGORIES))
    ) {
      return NextResponse.json(
        { error: "category must be a valid memory category" },
        { status: 400 }
      );
    }

    const updates = {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.priority !== undefined && { priority: body.priority }),
    };

    const memory = await updateMemory(id, updates);
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeMemory(memory));
  } catch (error) {
    console.error("[memories] PUT error", error);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const deleted = await deleteMemory(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[memories] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
