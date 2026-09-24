import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/server/routeAuth", () => ({ requireAppAuth: mocks.auth }));
import { POST } from "@/app/api/tts/xai/merge/route";

function tone(hz: number): Buffer {
  const result = spawnSync("/usr/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=0.3`, "-ar", "24000", "-b:a", "128k", "-f", "mp3", "pipe:1"]);
  if (result.status !== 0) throw new Error(String(result.stderr));
  return result.stdout;
}

describe("Orion MP3 merge route", () => {
  it("requires app authentication before accepting audio", async () => {
    mocks.auth.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const response = await POST(new NextRequest("http://local/api/tts/xai/merge", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("remuxes two ordered MP3 clips into one clean decodable file", async () => {
    const form = new FormData();
    form.append("clips", new Blob([new Uint8Array(tone(440))], { type: "audio/mpeg" }), "0.mp3");
    form.append("clips", new Blob([new Uint8Array(tone(660))], { type: "audio/mpeg" }), "1.mp3");
    const response = await POST(new NextRequest("http://local/api/tts/xai/merge", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    const merged = Buffer.from(await response.arrayBuffer());
    const decoded = spawnSync("/usr/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "null", "-"], { input: merged });
    expect(decoded.status).toBe(0);
    expect(String(decoded.stderr).trim()).toBe("");
  });
});
