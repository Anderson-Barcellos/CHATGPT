# Documentação

Esta pasta contém a documentação canônica do Celer Chat. Docs antigos de Vercel, Docker, Nginx e instalação Apache duplicada foram removidos para evitar instruções conflitantes com o runtime real.

## Fontes Principais

| Documento | Uso |
|---|---|
| [API](./API.md) | Contrato das rotas `app/api/*` |
| [Arquitetura](./ARCHITECTURE.md) | Como UI, proxy, streaming, storage, auth, artifacts e TTS se conectam |
| [Infraestrutura](./INFRASTRUCTURE.md) | Apache, systemd, variáveis, deploy e troubleshooting |
| [Modelos](./MODELS.md) | Catálogo local de modelos e regras de runtime |

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
- Atualize `INFRASTRUCTURE.md` quando mudar Apache, systemd, env ou portas.
- Atualize `API.md` quando mudar payload, rota, método ou auth.
- Atualize `MODELS.md` quando mudar `lib/models/modelConfig.ts` ou defaults.
- Não documente valores reais de segredos.
