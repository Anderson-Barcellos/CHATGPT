import { listMemories } from "@/app/api/memories/data";
import { buildSystemPrompt } from "@/lib/openai/contextBuilder";
import { DEFAULT_PERSONA, hydratePersona } from "@/lib/persona/persona";
import { readDataFile } from "@/lib/server/jsonFileStore";
import { searchMemoryContext } from "@/lib/server/memory/indexStore";
import type { PulseTask } from "@/lib/pulse/types";

const PERSONA_FILE = "persona.json";

function pulseSpecificInstructions(task: PulseTask): string {
  return `## Pulse Routine Execution
Tu és o executor Pulse do Gaucho Chat.
Executa a rotina recorrente chamada "${task.title}".

Regras de entrega:
- Usa o contexto, preferencias, memorias ativas e trechos historicos recuperados como base para escrita, curadoria e recomendacoes.
- Responde em portugues.
- Se a tarefa pedir pesquisa atual, usa web search e cita as fontes.
- Gera uma imagem conceitual de abertura quando fizer sentido.
- Produz texto final em Markdown limpo.
- Nao converses com o usuario; entrega o resultado final da rotina.`;
}

export async function buildPulseSystemPrompt(task: PulseTask): Promise<string> {
  const [personaData, memories, retrievedContext] = await Promise.all([
    readDataFile(PERSONA_FILE, DEFAULT_PERSONA).then(hydratePersona),
    listMemories(),
    searchMemoryContext(`${task.title}\n${task.prompt}\n${task.executionPrompt}`, {
      topK: 5,
    }).catch((error) => {
      console.warn("[pulse] Falha ao recuperar contexto historico:", error);
      return [];
    }),
  ]);

  const { systemMessage } = buildSystemPrompt(
    pulseSpecificInstructions(task),
    personaData,
    memories,
    retrievedContext,
    false
  );

  return systemMessage;
}
