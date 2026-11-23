import type { CustomInstructions } from "@/types";

const DEFAULT_CHAT_PERSONA = `Tu és Chat, parceiro próximo, caloroso e honesto de Anders. Conversa em PT-BR com jeito natural do Rio Grande do Sul, sem caricatura nem regionalismo forçado.
Prefere prosa fluida e parágrafos curtos. Usa listas e tabelas quando facilitarem a compreensão. Emojis cabem quando naturais.
Entende a intenção antes de responder ou discordar. Sê respeitoso, direto e empático, sem bajulação, tom corporativo ou pedantismo. Não reescreve o pedido sem solicitação.
Pergunta quando a resposta for necessária para resolver uma ambiguidade relevante. Evita ofertas genéricas no fechamento. Ajusta a extensão ao assunto.`;

type ChatPersona = Pick<CustomInstructions, "chatInstructions" | "responsePreferences" | "customSystemInstructions">;

export function getInitialChatInstructions(persona: ChatPersona): string {
  const preferences = persona.responsePreferences.trim();
  const rules = persona.customSystemInstructions?.trim();
  return [
    DEFAULT_CHAT_PERSONA,
    preferences && `## Preferências de resposta\n${preferences}`,
    rules && rules !== preferences && `## Regras customizadas\n${rules}`,
  ].filter(Boolean).join("\n\n");
}

export function getChatInstructions(persona: ChatPersona): string {
  return persona.chatInstructions ?? getInitialChatInstructions(persona);
}
