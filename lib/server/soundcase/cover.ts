import type { SoundCaseCoverReady } from "@/lib/soundcase/types";
import { resolveSoundCasePath, writeBufferDurable, writeTextDurable } from "@/lib/server/soundcase/files";

export interface SoundCaseImageClient {
  responses: { create(input: unknown): Promise<unknown> };
}

function extractPng(response: unknown): Buffer | null {
  if (!response || typeof response !== "object" || !("output" in response)) return null;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  const item = output.find((entry) => entry && typeof entry === "object" &&
    (entry as { type?: unknown }).type === "image_generation_call" &&
    (entry as { status?: unknown }).status === "completed");
  const result = item && typeof item === "object" ? (item as { result?: unknown }).result : null;
  if (typeof result !== "string" || result.length > 20_000_000) return null;
  const bytes = Buffer.from(result, "base64");
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    ? bytes : null;
}

function escapeXml(value: string): string {
  return value.replace(/[\0-\x08\x0B\x0C\x0E-\x1F]/gu, "")
    .replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}

function fallbackSvg(title: string): string {
  const safe = escapeXml(title.replace(/\s+/gu, " ").trim().slice(0, 100) || "SoundCase");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#071426"/><stop offset="1" stop-color="#1769d2"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="970" cy="90" r="260" fill="#55b7ff" opacity=".18"/><path d="M0 450 Q300 330 600 450 T1200 450 V630 H0Z" fill="#4aa8ff" opacity=".18"/><text x="88" y="322" fill="white" font-family="system-ui,sans-serif" font-size="62" font-weight="650">${safe}</text><text x="90" y="382" fill="#b9ddff" font-family="system-ui,sans-serif" font-size="24" letter-spacing="5">SOUNDCASE</text></svg>`;
}

export async function generateSoundCaseCover(input: {
  projectId: string;
  versionId: string;
  title: string;
  prompt: string;
  client: SoundCaseImageClient | null;
}): Promise<SoundCaseCoverReady> {
  const base = ["projects", input.projectId, "versions", input.versionId] as const;
  try {
    if (!input.client) throw new Error("soundcase_cover_client_missing");
    const response = await input.client.responses.create({
      model: "gpt-5.6-luna",
      input: input.prompt,
      store: false,
      tools: [{ type: "image_generation", model: "gpt-image-2", quality: "high", size: "auto", background: "auto", output_format: "png" }],
      tool_choice: { type: "image_generation" },
    });
    const png = extractPng(response);
    if (!png) throw new Error("soundcase_cover_png_invalid");
    const filePath = resolveSoundCasePath(...base, "cover.png");
    await writeBufferDurable(filePath, png);
    return { status: "ready", contentType: "image/png", fileName: "cover.png" };
  } catch {
    const filePath = resolveSoundCasePath(...base, "cover.svg");
    await writeTextDurable(filePath, fallbackSvg(input.title));
    return { status: "fallback", contentType: "image/svg+xml", fileName: "cover.svg" };
  }
}
