import { listMemories } from "@/app/api/memories/data";
import { DEFAULT_PERSONA, hydratePersona } from "@/lib/persona/persona";
import { readDataFile } from "@/lib/server/jsonFileStore";
import { searchMemoryContext } from "@/lib/server/memory/indexStore";
import type { PulseTask } from "@/lib/pulse/types";

const PERSONA_FILE = "persona.json";
const MAX_ACTIVE_MEMORIES = 5;
const MAX_MEMORY_CHARS = 900;
const MAX_RETRIEVED_CONTEXT = 3;
const MAX_RETRIEVED_CHARS = 1100;

function clip(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1).trim()}…`;
}

function pulseSpecificInstructions(task: PulseTask): string {
  return `## Pulse Routine Execution
Tu és o executor Pulse do Gaucho Chat.
Executa a rotina recorrente chamada "${task.title}".

Regras de entrega:
- Usa somente as instrucoes e contextos uteis fornecidos neste prompt.
- Responde em portugues.
- Se a tarefa pedir pesquisa atual, usa web search e cita as fontes, mas faz curadoria: prioriza ate 4 eixos/fontes principais antes de escrever.
- O resultado deve ter uma imagem conceitual de abertura. Se a imagem nao sair na chamada principal, o sistema tentara gerar uma capa em fallback.
- Produz texto final em Markdown limpo.
- Nao converses com o usuario; entrega o resultado final da rotina.`;
}

export async function buildPulseSystemPrompt(task: PulseTask): Promise<string> {
  const [personaData, memories, retrievedContext] = await Promise.all([
    readDataFile(PERSONA_FILE, DEFAULT_PERSONA).then(hydratePersona),
    listMemories(),
    searchMemoryContext(`${task.title}\n${task.prompt}\n${task.executionPrompt}`, {
      topK: MAX_RETRIEVED_CONTEXT,
    }).catch((error) => {
      console.warn("[pulse] Falha ao recuperar contexto historico:", error);
      return [];
    }),
  ]);

  const sections = [pulseSpecificInstructions(task)];

  const preferences = [
    personaData.contextAboutUser.trim()
      ? `Contexto sobre Anders: ${clip(personaData.contextAboutUser, 1200)}`
      : "",
    personaData.responsePreferences.trim()
      ? `Preferencias de resposta: ${clip(personaData.responsePreferences, 1200)}`
      : "",
    personaData.customSystemInstructions?.trim()
      ? `Instrucoes customizadas: ${clip(personaData.customSystemInstructions, 1200)}`
      : "",
  ].filter(Boolean);

  if (preferences.length > 0) {
    sections.push(`## Preferencias pessoais uteis\n${preferences.join("\n")}`);
  }

  const activeMemories = memories
    .filter((memory) => memory.isActive)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_ACTIVE_MEMORIES)
    .map((memory) => `- ${clip(memory.content, MAX_MEMORY_CHARS)}`);

  if (activeMemories.length > 0) {
    sections.push(`## Memorias ativas relevantes\n${activeMemories.join("\n")}`);
  }

  if (retrievedContext.length > 0) {
    sections.push(
      `## Trechos historicos recuperados\n${retrievedContext
        .map(
          (item, index) =>
            `### Trecho ${index + 1}\nFonte: ${
              item.conversationTitle || "Conversa"
            }\n${clip(item.text, MAX_RETRIEVED_CHARS)}`
        )
        .join("\n\n")}`
    );
  }

  const systemMessage = sections.join("\n\n---\n\n");

  return systemMessage;
}
