import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { readDiscoverImage } from "@/lib/discover/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAppAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const image = await readDiscoverImage(id);
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
