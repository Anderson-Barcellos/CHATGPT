import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { isAuthEnabled, isAuthenticatedRequest } from "@/lib/server/auth";
import { serializeConversation } from "@/lib/storage/serializers";
import { restoreConversation } from "../../data";

function unauthorized() {
  return jsonError(401, "Unauthorized", {
    message: "Faça login para continuar.",
    code: "unauthorized",
  });
}

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isAuthEnabled() && !(await isAuthenticatedRequest(request))) {
    return unauthorized();
  }

  const { id } = await params;
  const restored = await restoreConversation(id);
  if (!restored) {
    return jsonError(404, "Not found", {
      message: "Conversa nao encontrada.",
      code: "conversation_not_found",
    });
  }
  return NextResponse.json(serializeConversation(restored));
}
