import { describe, expect, it } from "vitest";
import {
  buildAbortedAssistantMessagePatch,
  buildInterruptedAssistantMessagePatch,
  CANCELED_GENERATION_MESSAGE,
  INTERRUPTED_GENERATION_MESSAGE,
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

describe("buildInterruptedAssistantMessagePatch", () => {
  it("preserves partial content when stream is interrupted by reload", () => {
    const state = {
      ...createInitialAssistantStreamState(true),
      content: "Pedaço da resposta antes do reload.",
    };

    expect(buildInterruptedAssistantMessagePatch(state, true)).toMatchObject({
      content: "Pedaço da resposta antes do reload.",
      streamStatus: "interrupted",
    });
  });

  it("falls back to interrupted message when there is no content", () => {
    const state = createInitialAssistantStreamState(false);

    expect(buildInterruptedAssistantMessagePatch(state, false)).toMatchObject({
      content: INTERRUPTED_GENERATION_MESSAGE,
      streamStatus: "interrupted",
    });
  });

  it("clears reasoning status when reasoning was used", () => {
    const state = createInitialAssistantStreamState(true);

    expect(buildInterruptedAssistantMessagePatch(state, true)).toMatchObject({
      streamStatus: "interrupted",
      reasoningStatus: "complete",
    });
  });
});
