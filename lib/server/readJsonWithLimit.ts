export type ReadJsonWithLimitResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "invalid_json" | "too_large";
      status: 400 | 413;
    };

interface ReadJsonWithLimitOptions {
  limitBytes: number;
}

export async function readJsonWithLimit<T>(
  request: Request,
  { limitBytes }: ReadJsonWithLimitOptions
): Promise<ReadJsonWithLimitResult<T>> {
  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "invalid_json", status: 400 };
  }

  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let rawBody = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    receivedBytes += value.byteLength;
    if (receivedBytes > limitBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: "too_large", status: 413 };
    }

    rawBody += decoder.decode(value, { stream: true });
  }

  rawBody += decoder.decode();

  try {
    return { ok: true, value: JSON.parse(rawBody) as T };
  } catch {
    return { ok: false, reason: "invalid_json", status: 400 };
  }
}
