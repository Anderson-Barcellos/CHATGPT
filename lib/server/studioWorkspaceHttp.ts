import { jsonError } from "@/lib/api/errors";

const REASON_TO_STATUS: Record<string, { status: number; message: string }> = {
  invalid_path: { status: 400, message: "Caminho inválido no workspace." },
  not_found: { status: 404, message: "Arquivo não encontrado no workspace." },
  too_large: { status: 413, message: "Arquivo excede o limite editável de 1 MB." },
  binary: { status: 415, message: "Arquivo binário não abre no editor." },
  already_exists: { status: 409, message: "Já existe um arquivo nesse destino." },
  write_failed: { status: 500, message: "Falha ao gravar no workspace." },
};

export function studioWorkspaceErrorResponse(reason: string): Response {
  const mapped = REASON_TO_STATUS[reason] ?? {
    status: 500,
    message: "Falha inesperada no workspace.",
  };

  return jsonError(mapped.status, "Studio workspace error", {
    message: mapped.message,
    code: `studio_workspace_${reason}`,
  });
}
