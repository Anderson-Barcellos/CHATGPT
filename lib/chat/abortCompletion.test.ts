import { describe, expect, it } from "vitest";
import {
  buildAbortedAssistantMessagePatch,
  CANCELED_GENERATION_MESSAGE,
} from "@/lib/chat/abortCompletion";
import { createInitialAssistantStreamState } from "@/lib/chat/streamMachine";

describe("buildAbortedAssistantMessagePatch", () => {
  it("preserves partial content when generation is aborted", () => {
    const state = {
      ...createInitialAssistantStreamState(false),
      content: "Resposta parcial ja util.",
    };

    expect(buildAbortedAssistantMessagePatch(state, false)).toMatchObject({
      content: "Resposta parcial ja util.",
      streamStatus: "aborted",
    });
  });

  it("shows a short cancel message when no content was generated", () => {
    const state = createInitialAssistantStreamState(false);

    expect(buildAbortedAssistantMessagePatch(state, false)).toMatchObject({
      content: CANCELED_GENERATION_MESSAGE,
      streamStatus: "aborted",
    });
  });
});
