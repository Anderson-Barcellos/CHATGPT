import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { inferChatModelProvider, OPENAI_REASONING_EFFORTS } from "@/lib/models/chatModelCatalog";
import {
  addChatModel,
  deleteChatModel, reorderChatModels, applyChatBadges,
  ChatCatalogError,
  readChatModelCatalog,
  updateChatModel,
} from "@/lib/server/chatModelCatalog";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";
import { requireAppAuth } from "@/lib/server/routeAuth";
import type { ReasoningEffort } from "@/types";

import { suggestChatBadges } from "@/lib/server/chatBadgeSuggestions";

const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof ChatCatalogError) {
    return jsonError(error.status, error.message);
  }
  console.error("[chat/model-catalog] falha interna", (error as NodeJS.ErrnoException)?.code ?? "unexpected");
  return jsonError(500, "Não consegui acessar o catálogo de modelos.");
}

export async function GET(request: NextRequest) {
  const auth = await requireAppAuth(request);
  if (auth) return auth;
  try {
    return Response.json(await readChatModelCatalog(), { headers });
  } catch (error) {
    return failure(error);
  }
}

async function save(request: NextRequest, action: "add" | "update" | "delete") {
  const auth = await requireAppAuth(request);
  if (auth) return auth;
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return jsonError(415, "Envie os dados do modelo em JSON.");
  const parsed = await readJsonWithLimit<Record<string, unknown> | null>(request, { limitBytes: 262144 });
  if (!parsed.ok) return jsonError(parsed.status, "Dados do modelo inválidos.");

  const body = parsed.value ?? {};
  const { id, name, revision, visible, openAIEfforts, newId, badge } = body;
  const cleanId = typeof id === "string" ? id.trim() : "";
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
    return jsonError(400, "Recarregue o catálogo e tente novamente.");
  }
  try {
    if (action === "add" && body.action === "suggest") {
      return Response.json(await suggestChatBadges(revision, request.signal), { headers });
    }
    if (action === "delete" && cleanId) {
      return Response.json(await deleteChatModel(revision, cleanId), { headers });
    }
    if (action === "update" && body.action === "reorder" && Array.isArray(body.ids) && body.ids.every(id => typeof id === "string")) {
      return Response.json(await reorderChatModels(revision, body.ids), { headers });
    }
    if (action === "update" && body.action === "badges" && Array.isArray(body.badges)
      && body.badges.every(item => typeof item?.id === "string" && typeof item.badge === "string" && item.badge.length <= 32)) {
      return Response.json(await applyChatBadges(revision, body.badges), { headers });
    }
  } catch (error) {
    return failure(error);
  }
  if (action === "delete" || body.action !== undefined || !cleanName || cleanName.length > 80 || !cleanId || cleanId.length > 128
    || (newId !== undefined && (typeof newId !== "string" || !newId.trim() || newId.length > 128))
    || (badge !== undefined && (typeof badge !== "string" || badge.length > 32))) {
    return jsonError(400, "Confira o nome, o ID e o rótulo do modelo.");
  }
  if (
    openAIEfforts !== undefined &&
    (!Array.isArray(openAIEfforts) ||
      openAIEfforts.some((effort: ReasoningEffort) => !OPENAI_REASONING_EFFORTS.includes(effort)))
  ) {
    return jsonError(400, "Os níveis de raciocínio informados são inválidos.");
  }
  const efforts = Array.isArray(openAIEfforts)
    ? OPENAI_REASONING_EFFORTS.filter((effort) => openAIEfforts.includes(effort))
    : undefined;

  try {
    if (action === "update") {
      if (typeof visible !== "boolean") return jsonError(400, "Informe a visibilidade do modelo.");
      return Response.json(await updateChatModel(revision, cleanId, cleanName, visible, efforts, newId?.trim(), badge, request.signal), { headers });
    }

    const provider = inferChatModelProvider(cleanId);
    if (!provider) return jsonError(422, "Use um ID de modelo de chat da OpenAI, da Anthropic ou do Google (Gemini).");
    if (provider !== "openai" && efforts !== undefined) {
      return jsonError(400, "Os níveis de raciocínio informados são inválidos.");
    }
    const data = await addChatModel(revision, cleanId, cleanName, provider, efforts ?? [], request.signal);
    return Response.json(data, { status: 201, headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  return save(request, "add");
}

export async function DELETE(request: NextRequest) {
  return save(request, "delete");
}

export async function PATCH(request: NextRequest) {
  return save(request, "update");
}
