# CLAUDE.md

Este arquivo é a ponte compacta para Claude Code. A autoridade operacional é `AGENTS.md`; não replique aqui changelog, roadmaps encerrados ou arquitetura detalhada.

## Leitura inicial

- `AGENTS.md`: regras locais, estado atual, invariantes e diário append-only.
- `README.md`: visão geral e estrutura.
- `docs/API.md`: contratos de rotas.
- `docs/ARCHITECTURE.md`: fluxos e fronteiras.
- `docs/INFRASTRUCTURE.md`: Apache, systemd, env e deploy.
- `docs/MODELS.md`: catálogo e defaults.
- `BACKLOG.md`: somente a frente ativa; hoje não há PACK/BUNDLE ativo.

## Estado atual

- Next.js 16 com `basePath=/chat`; produção em `chatgpt.service`, porta `3040`.
- Shell único: `GauchoChatShellV2` / `workspace-v2`.
- Chat principal via OpenAI Responses API; DeepSeek V4 Pro e Gemini 3.6 Flash usam adapters server-side apenas no chat padrão streaming.
- Documento, Deepsearch e Quiz continuam em fluxos OpenAI forçados.
- Pulse é a superfície visível de rotinas; Calendar/OAuth permanece backend legado operacional.
- Persistência pessoal vive em `data/*.json`; esses arquivos não são fixtures e não devem ser alterados sem pedido explícito.

## Invariantes

- Não trocar Responses API por Chat Completions no fluxo OpenAI.
- `useChat.ts` é o orquestrador do envio, streaming, background e persistência.
- Balões usam key estável `message.id`; não incluir `artifact.id`.
- `NEXT_PUBLIC_BASE_PATH=/chat` precisa permanecer alinhado entre Next, Apache, systemd e `apiUrl()`.
- O cookie usa `Path=/chat`; `ProxyPassReverseCookiePath / /chat` fica dentro de `<Location /chat>`.
- Somente `/api/calendar/events/confirm` escreve no Google; drafts são locais.
- Não expor segredos, tokens OAuth ou dados runtime em logs, docs ou commits.

## Validação

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Para runtime/deploy, consulte `/etc/apache2/APACHE.md`, reinicie `chatgpt.service` e valide:

- `http://127.0.0.1:3040/chat/api/health`
- `https://ultrassom.ai/chat/api/health`

Preserve mudanças locais não relacionadas. Atualize o documento canônico correspondente quando alterar API, arquitetura, modelos ou infraestrutura.
