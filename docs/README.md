# Documentação

Esta pasta contém a documentação canônica do Gaucho Chat. Docs antigos de Vercel, Docker, Nginx e instalação Apache duplicada foram removidos para evitar instruções conflitantes com o runtime real.

## Fontes Principais

| Documento | Uso |
|---|---|
| [API](./API.md) | Contrato das rotas `app/api/*`, incluindo chat OpenAI/DeepSeek, memória/RAG, persona, Pulse, agenda legada e voz |
| [Arquitetura](./ARCHITECTURE.md) | Como UI, proxy, streaming, providers, storage, auth, memória/RAG, artifacts e TTS se conectam |
| [Infraestrutura](./INFRASTRUCTURE.md) | Apache, systemd, variáveis, deploy e troubleshooting |
| [Modelos](./MODELS.md) | Catálogo local de modelos e regras de runtime |

## Documentos De Trabalho / Retomada

| Documento | Uso |
|---|---|
| [Redesign Roadpack](./REDESIGN_ROADPACK.md) | Documento vivo do shell clínico, refinamentos visuais e densidade mobile |
| [Kickoff Codex](./CODEX_KICKOFF.md) | Handoff de refinamentos visuais Codex e próximos bundles seguros |

## Históricos Mantidos Por Contexto

| Documento | Uso |
|---|---|
| [Kickoff Agenda/Notas](./CALENDAR_NOTES_KICKOFF.md) | Contexto histórico da V1; nao usar como fonte canônica do estado atual |
| [Kickoff C2 Agenda/Notas](./CALENDAR_NOTES_C2_KICKOFF.md) | Handoff histórico do bundle C2; mantido apenas como trilha de decisão |
| [Progresso Agenda/Notas](./CALENDAR_NOTES_PROGRESS.md) | Quadro histórico da frente Agenda Google + Notas; Pulse é a superfície recorrente atual |
| [Kickoff Fresh Agenda/Notas](./CALENDAR_NOTES_FRESH_KICKOFF.md) | Handoff histórico da frente Agenda/Notas; não usar como estado principal atual |

## Documentos Fora Desta Pasta

| Arquivo | Uso |
|---|---|
| [README](../README.md) | Visão geral do projeto |
| [AGENTS](../AGENTS.md) | Memória operacional e decisões recentes |
| [CLAUDE](../CLAUDE.md) | Handoff técnico compacto para sessões futuras |
| [systemd/chatgpt.service](../systemd/chatgpt.service) | Unit versionada |
| [apache-config/chat.conf](../apache-config/chat.conf) | Exemplo versionado do proxy `/chat` |

## Regras de Atualização

- Atualize `AGENTS.md` ao fim de uma rodada significativa.
- Atualize o documento de progresso/ROADPACK ativo durante o processo, não só no fechamento.
- Atualize `INFRASTRUCTURE.md` quando mudar Apache, systemd, env ou portas.
- Atualize `API.md` quando mudar payload, rota, método ou auth.
- Atualize `MODELS.md` quando mudar `lib/models/modelConfig.ts` ou defaults.
- Não documente valores reais de segredos.
