import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspaceNote,
  deleteWorkspaceNote,
  listWorkspaceNotes,
} from "@/lib/storage/workspaceNotesApi";

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("workspaceNotesApi client wrappers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.NEXT_PUBLIC_BASE_PATH = "/chat";
  });

  it("lists notes with filters through the configured basePath", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ notes: [] }));

    await expect(
      listWorkspaceNotes({ source: "stt", conversationId: "conv-1" })
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/workspace-notes?source=stt&conversationId=conv-1",
      { cache: "no-store" }
    );
  });

  it("creates STT notes with conversation metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          id: "note-1",
          title: "Captura por voz",
          body: "Texto transcrito",
          source: "stt",
          conversationId: "conv-1",
          tags: ["voz"],
          createdAt: "2026-06-03T14:00:00.000Z",
          updatedAt: "2026-06-03T14:00:00.000Z",
        },
        { status: 201 }
      )
    );

    const note = await createWorkspaceNote({
      title: "Captura por voz",
      body: "Texto transcrito",
      source: "stt",
      conversationId: "conv-1",
      tags: ["voz"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/chat/api/workspace-notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Captura por voz",
          body: "Texto transcrito",
          source: "stt",
          conversationId: "conv-1",
          tags: ["voz"],
        }),
      })
    );
    expect(note.source).toBe("stt");
  });

  it("deletes notes by id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await deleteWorkspaceNote("note-1");

    expect(fetchMock).toHaveBeenCalledWith("/chat/api/workspace-notes/note-1", {
      method: "DELETE",
    });
  });
});
