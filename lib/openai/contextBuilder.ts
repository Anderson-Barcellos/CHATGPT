import { CustomInstructions, Memory } from "@/types";
import { buildSystemPrompt as buildBasePrompt } from "@/lib/prompts/systemPrompt";
import { FIXED_PERSONA_PROMPT } from "@/lib/prompts/personaPrompt";

export function buildSystemPrompt(
  _basePrompt: string,
  instructions: CustomInstructions,
  memories: Memory[]
) {
  const sections: string[] = [];

  sections.push(buildBasePrompt());

  sections.push(FIXED_PERSONA_PROMPT);

  if (instructions.contextAboutUser.trim()) {
    sections.push(`## Additional Context About the User\n${instructions.contextAboutUser.trim()}`);
  }

  const activeMemories = memories
    .filter((memory) => memory.isActive)
    .sort((a, b) => b.priority - a.priority);

  if (activeMemories.length > 0) {
    const memoryText = activeMemories
      .map((memory) => `- ${memory.content}`)
      .join("\n");
    sections.push(`## Important Context to Remember\n${memoryText}`);
  }

  const systemMessage = sections.join("\n\n---\n\n");

  return {
    systemMessage,
    injectedMemories: activeMemories,
  };
}
