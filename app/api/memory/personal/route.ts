import { NextRequest, NextResponse } from "next/server";
import { requireAppAuth } from "@/lib/server/routeAuth";
import { getPersonalSynthesis, schedulePersonalSynthesis } from "@/lib/server/memory/personalSynthesis";
import { searchPersonalSources } from "@/lib/server/memory/personalIndex";
import { renderSources } from "@/lib/server/memory/personalSources";
import { readJsonWithLimit } from "@/lib/server/readJsonWithLimit";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const unauthorized = await requireAppAuth(request); if (unauthorized) return unauthorized;
  const state = await getPersonalSynthesis();
  schedulePersonalSynthesis();
  return NextResponse.json({ status: state.status, summary: state.valid ? state.record.summary : "", generatedAt: state.valid ? state.record.generatedAt : null,
    originalChars: state.originalChars, summaryChars: state.valid ? state.record.summary.length : 0,
    error: state.status === "failed" ? state.record.error : null, items: state.valid ? state.record.items : [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAppAuth(request); if (unauthorized) return unauthorized;
  const parsed = await readJsonWithLimit<{ query?: unknown; regenerate?: unknown; draft?: unknown }>(request, { limitBytes: 256000 });
  if (!parsed.ok) return NextResponse.json({ error: "Invalid personal context request" }, { status: parsed.status });
  const body = parsed.value;
  if (!body || typeof body !== "object" || (body.query !== undefined && typeof body.query !== "string")) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  if (body.regenerate === true) {
    schedulePersonalSynthesis(true);
    return NextResponse.json({ status: "pending" }, { status: 202 });
  }
  let draft: Record<string, string> | undefined;
  if (body.draft !== undefined) {
    if (!body.draft || typeof body.draft !== "object" || Array.isArray(body.draft) || Object.entries(body.draft).some(([key, value]) => !["contextAboutUser", "importedBiography"].includes(key) || typeof value !== "string")) {
      return NextResponse.json({ error: "Invalid personal draft" }, { status: 400 });
    }
    draft = body.draft as Record<string, string>;
  }
  const details = await searchPersonalSources(typeof body.query === "string" ? body.query : "");
  // Read once more after retrieval: a concurrent edit invalidates both summary and chunks.
  const state = await getPersonalSynthesis();
  const sources = state.sources.filter(source => !(draft && ((source.id === "profile:about" && "contextAboutUser" in draft) || (source.id === "profile:imported" && "importedBiography" in draft))));
  if (draft?.contextAboutUser) sources.push({ id: "profile:about", text: draft.contextAboutUser });
  if (draft?.importedBiography) sources.push({ id: "profile:imported", text: draft.importedBiography });
  const personalText = draft ? renderSources(sources) : state.text;
  const currentDetails = draft || !state.valid ? [] : details.filter(detail => sources.some(source => source.id === detail.sourceId && source.text.slice(detail.offset, detail.offset + 1200) === detail.text));
  schedulePersonalSynthesis();
  return NextResponse.json({ revision: state.hash, mode: state.valid && !draft ? "summary" : "originals", personalText,
    details: currentDetails, responsePreferences: state.persona.responsePreferences, customSystemInstructions: state.persona.customSystemInstructions || "",
  }, { headers: { "Cache-Control": "no-store" } });
}
