import { constants, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import type { SoundCaseVersion } from "@/lib/soundcase/types";
import { resolveSoundCasePath } from "@/lib/server/soundcase/files";

export type SoundCaseAssetKind = "audio" | "cover";

function assetMetadata(version: SoundCaseVersion, kind: SoundCaseAssetKind) {
  if (kind === "audio") {
    if (version.audio.status !== "ready") return null;
    const expectedName = `final.${version.audio.format}`;
    if (version.audio.fileName !== expectedName) return null;
    const expectedType = version.audio.format === "mp3"
      ? "audio/mpeg"
      : version.audio.format === "flac" ? "audio/flac" : "audio/wav";
    if (version.audio.contentType !== expectedType) return null;
    return { fileName: expectedName, contentType: expectedType };
  }
  if (version.cover.status === "pending") return null;
  const expected = version.cover.status === "ready"
    ? { fileName: "cover.png", contentType: "image/png" }
    : { fileName: "cover.svg", contentType: "image/svg+xml" };
  return version.cover.fileName === expected.fileName && version.cover.contentType === expected.contentType
    ? expected : null;
}

function contentDisposition(fileName: string, download: boolean): string {
  const mode = download ? "attachment" : "inline";
  return `${mode}; filename="${fileName}"`;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = header.match(/^bytes=(\d+)-(\d*)$/u);
  if (!match) return "invalid";
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) {
    return "invalid";
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function streamSoundCaseAsset(input: {
  request: Request;
  version: SoundCaseVersion;
  kind: SoundCaseAssetKind;
}): Promise<Response> {
  const metadata = assetMetadata(input.version, input.kind);
  if (!metadata) return Response.json({
    error: "SoundCase asset not ready", code: "soundcase_asset_not_ready",
  }, { status: 404 });
  const filePath = resolveSoundCasePath(
    "projects", input.version.projectId, "versions", input.version.id, metadata.fileName
  );
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    return Response.json({ error: "SoundCase asset not found", code: "soundcase_asset_not_found" }, { status: 404 });
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size <= 0) {
      await handle.close();
      return Response.json({ error: "SoundCase asset not found", code: "soundcase_asset_not_found" }, { status: 404 });
    }
    const range = parseRange(input.request.headers.get("range"), info.size);
    if (range === "invalid") {
      await handle.close();
      return new Response(null, { status: 416, headers: {
        "Accept-Ranges": "bytes", "Content-Range": `bytes */${info.size}`,
      } });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? info.size - 1;
    const stream = handle.createReadStream({ start, end, autoClose: true });
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": metadata.contentType,
      "Content-Length": String(end - start + 1),
      "Content-Disposition": contentDisposition(
        metadata.fileName,
        new URL(input.request.url).searchParams.get("download") === "1"
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}
