import { createQuizArtifact } from "@/lib/artifacts/quizArtifacts";
import type { Message } from "@/types";

export function buildQuizCompletionPatch(rawContent: string): Partial<Message> {
  const artifact = createQuizArtifact(rawContent);

  if (!artifact) {
    return {
      content: rawContent,
      preferredDisplayMode: undefined,
      streamStatus: "failed",
    };
  }

  return {
    content: artifact.summary,
    artifact,
    preferredDisplayMode: "quiz",
    streamStatus: "completed",
  };
}
