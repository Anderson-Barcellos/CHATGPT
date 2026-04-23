export interface ApiErrorPayload {
  error: string;
  message?: string;
  code?: string;
}

export class ClientApiError extends Error {
  status: number;
  code?: string;
  error: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || payload.error);
    this.name = "ClientApiError";
    this.status = status;
    this.code = payload.code;
    this.error = payload.error;
  }
}

export function jsonError(
  status: number,
  error: string,
  options: { message?: string; code?: string } = {}
) {
  return Response.json(
    {
      error,
      ...(options.message ? { message: options.message } : {}),
      ...(options.code ? { code: options.code } : {}),
    } satisfies ApiErrorPayload,
    { status }
  );
}

export async function parseApiErrorResponse(
  response: Response
): Promise<ClientApiError> {
  const fallbackPayload: ApiErrorPayload = {
    error: response.statusText || "Request failed",
  };

  try {
    const text = await response.text();
    if (!text) {
      return new ClientApiError(response.status, fallbackPayload);
    }

    const parsed = JSON.parse(text) as Partial<ApiErrorPayload>;
    return new ClientApiError(response.status, {
      error:
        typeof parsed.error === "string" && parsed.error.trim().length > 0
          ? parsed.error
          : fallbackPayload.error,
      ...(typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? { message: parsed.message }
        : {}),
      ...(typeof parsed.code === "string" && parsed.code.trim().length > 0
        ? { code: parsed.code }
        : {}),
    });
  } catch {
    return new ClientApiError(response.status, fallbackPayload);
  }
}
