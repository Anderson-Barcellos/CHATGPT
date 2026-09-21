import "server-only";

const XAI_API_ROOT = "https://api.x.ai/v1";
const XAI_REQUEST_TIMEOUT_MS = 15_000;

export class SoundCaseGrokRealtimeError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
    this.name = "SoundCaseGrokRealtimeError";
  }
}

function xaiKey(): string {
  const key = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (!key) throw new SoundCaseGrokRealtimeError(
    "soundcase_grok_realtime_unavailable",
    "A voz Grok Realtime ainda não está disponível neste ambiente.",
    503
  );
  return key;
}

async function xaiRequest(path: string, init: RequestInit): Promise<Response> {
  const key = xaiKey();
  const timeout = AbortSignal.timeout(XAI_REQUEST_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`${XAI_API_ROOT}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
      signal,
    });
  } catch {
    throw new SoundCaseGrokRealtimeError("soundcase_grok_realtime_network", "Não foi possível alcançar a voz Grok Realtime.");
  }
  if (!response.ok) {
    throw new SoundCaseGrokRealtimeError(
      "soundcase_grok_realtime_provider",
      "A voz Grok Realtime recusou esta solicitação. Tente novamente em instantes.",
      response.status >= 400 && response.status < 500 ? 502 : 503
    );
  }
  return response;
}

export async function createSoundCaseGrokEphemeralToken(signal?: AbortSignal): Promise<string> {
  const response = await xaiRequest("/realtime/client_secrets", {
    method: "POST",
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
    signal,
  });
  const body = await response.json().catch(() => null) as { value?: unknown; client_secret?: { value?: unknown } } | null;
  const token = typeof body?.value === "string" ? body.value
    : typeof body?.client_secret?.value === "string" ? body.client_secret.value : null;
  if (!token) throw new SoundCaseGrokRealtimeError("soundcase_grok_realtime_token_invalid", "A voz Grok Realtime retornou uma sessão inválida.");
  return token;
}

export interface SoundCaseGrokVoice { id: string; name: string; }

export async function listSoundCaseGrokVoices(signal?: AbortSignal): Promise<SoundCaseGrokVoice[]> {
  const response = await xaiRequest("/tts/voices", { method: "GET", signal });
  const body = await response.json().catch(() => null) as { data?: unknown; voices?: unknown } | null;
  const values = Array.isArray(body?.data) ? body.data : Array.isArray(body?.voices) ? body.voices : [];
  return values.flatMap((value): SoundCaseGrokVoice[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as { id?: unknown; voice_id?: unknown; name?: unknown };
    const id = typeof item.voice_id === "string" && item.voice_id.trim() ? item.voice_id : item.id;
    if (typeof id !== "string" || !id.trim()) return [];
    return [{ id, name: typeof item.name === "string" && item.name.trim() ? item.name : id }];
  });
}
