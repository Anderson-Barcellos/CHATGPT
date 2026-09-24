import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextRequest } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);
const MAX_CLIPS = 120;
const MAX_BYTES = 150 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
    return Response.json({ error: "Áudio grande demais para juntar." }, { status: 413 });
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Trechos de áudio inválidos." }, { status: 400 }); }
  const clips = form.getAll("clips");
  if (clips.length < 2 || clips.length > MAX_CLIPS || clips.some((clip) => typeof clip === "string" || typeof clip.arrayBuffer !== "function")) {
    return Response.json({ error: "É preciso enviar de 2 a 120 trechos MP3." }, { status: 400 });
  }
  if (clips.reduce((size, clip) => size + (clip as File).size, 0) > MAX_BYTES) {
    return Response.json({ error: "Áudio grande demais para juntar." }, { status: 413 });
  }

  const directory = await fs.mkdtemp(path.join(tmpdir(), "gaucho-orion-merge-"));
  try {
    const playlist: string[] = [];
    for (const [index, clip] of clips.entries()) {
      const bytes = new Uint8Array(await (clip as File).arrayBuffer());
      if (bytes.byteLength < 4) return Response.json({ error: "Trecho MP3 vazio ou inválido." }, { status: 400 });
      const filename = `${index.toString().padStart(3, "0")}.mp3`;
      await fs.writeFile(path.join(directory, filename), bytes);
      playlist.push(`file '${filename}'`);
    }
    const listPath = path.join(directory, "list.txt");
    const outputPath = path.join(directory, "complete.mp3");
    await fs.writeFile(listPath, `${playlist.join("\n")}\n`);
    await run("/usr/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-map", "0:a:0", "-c", "copy", "-y", outputPath], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    const audio = await fs.readFile(outputPath);
    if (!audio.byteLength) throw new Error("empty_output");
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("xAI TTS merge failed", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Não foi possível montar o MP3 completo." }, { status: 502 });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
