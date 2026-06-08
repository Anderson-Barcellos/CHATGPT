import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceNoteInput,
  WorkspaceNoteValidationError,
} from "@/lib/storage/workspaceNotes";

describe("workspace notes", () => {
  it("normalizes local notes with default title and tags", () => {
    const note = normalizeWorkspaceNoteInput(
      {
        body: "Primeira linha\nDetalhes da nota",
        source: "stt",
        conversationId: "conv-1",
        tags: [" Voz ", "voz", "", "Agenda"],
      },
      new Date("2026-06-03T12:00:00.000Z")
    );

    expect(note).toMatchObject({
      title: "Primeira linha",
      body: "Primeira linha\nDetalhes da nota",
      source: "stt",
      conversationId: "conv-1",
      tags: ["voz", "agenda"],
      createdAt: "2026-06-03T12:00:00.000Z",
      updatedAt: "2026-06-03T12:00:00.000Z",
    });
  });

  it("rejects empty note bodies", () => {
    expect(() => normalizeWorkspaceNoteInput({ body: " " })).toThrow(
      WorkspaceNoteValidationError
    );
  });
});
