import { NextResponse } from "next/server";

/** Liveness público: confirma apenas que o processo consegue responder. */
export function GET() {
  return NextResponse.json(
    { status: "live" },
    {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
