# Documentação

Esta é a superfície documental canônica do Gaucho Chat. Handoffs encerrados, planos concluídos e conceitos visuais antigos ficam preservados no histórico Git, não ao lado das referências atuais.

| Documento | Fonte de verdade |
|---|---|
| [README](../README.md) | Visão geral, stack, estrutura e comandos essenciais |
| [API](./API.md) | Contratos das rotas `app/api/*` |
| [Arquitetura](./ARCHITECTURE.md) | Fluxos, providers, persistência e fronteiras do sistema |
| [Infraestrutura](./INFRASTRUCTURE.md) | Apache, systemd, env, deploy e troubleshooting |
| [Modelos](./MODELS.md) | Catálogo e regras de runtime de modelos |

Documentos operacionais:

- [AGENTS](../AGENTS.md): instruções locais, invariantes e diário append-only.
- [BACKLOG](../BACKLOG.md): frente ativa; quando não houver pack ativo, deve dizê-lo explicitamente.
- [CLAUDE](../CLAUDE.md): ponte compacta para agentes Claude.
- [.codex_remember/remember.md](../.codex_remember/remember.md): handoff curto da sessão mais recente.

Regras de manutenção:

- Mudou rota ou payload: atualize `API.md`.
- Mudou provider, fluxo ou persistência: atualize `ARCHITECTURE.md`.
- Mudou modelo/default: atualize `MODELS.md`.
- Mudou Apache, systemd, porta ou env: atualize `INFRASTRUCTURE.md` e, quando aplicável, `/etc/apache2/APACHE.md`.
- Nunca copie segredos ou dados runtime privados para a documentação.
