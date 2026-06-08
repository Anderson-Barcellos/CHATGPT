import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAppAuthMock = vi.fn();
const createWorkspaceNoteMock = vi.fn();
const listWorkspaceNotesMock = vi.fn();

vi.mock("@/lib/server/routeAuth", () => ({
  requireAppAuth: requireAppAuthMock,
}));

vi.mock("@/lib/storage/workspaceNotes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/workspaceNotes")>(
    "@/lib/storage/workspaceNotes"
  );
  return {
    ...actual,
    createWorkspaceNote: createWorkspaceNoteMock,
    listWorkspaceNotes: listWorkspaceNotesMock,
  };
});

describe("/api/workspace-notes route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAppAuthMock.mockResolvedValue(null);
  });

  it("creates a local note", async () => {
    createWorkspaceNoteMock.mockResolvedValueOnce({
      id: "note-1",
      title: "Nota",
      body: "Texto",
      source: "manual",
      tags: [],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/workspace-notes", {
        method: "POST",
        body: JSON.stringify({ body: "Texto" }),
      })
    );

    expect(response.status).toBe(201);
    expect(createWorkspaceNoteMock).toHaveBeenCalledWith({ body: "Texto" });
    await expect(response.json()).resolves.toMatchObject({ id: "note-1" });
  });

  it("lists notes with optional filters", async () => {
    listWorkspaceNotesMock.mockResolvedValueOnce([]);

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/workspace-notes?source=stt&conversationId=conv-1"
      )
    );

    expect(response.status).toBe(200);
    expect(listWorkspaceNotesMock).toHaveBeenCalledWith({
      source: "stt",
      conversationId: "conv-1",
      calendarEventId: undefined,
    });
  });
});
