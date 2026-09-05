# CLAUDE.md

Este arquivo é a ponte compacta para Claude Code. A autoridade operacional é `AGENTS.md`; não replique aqui changelog, roadmaps encerrados ou arquitetura detalhada.

## Leitura inicial

- `AGENTS.md`: regras locais, estado atual, invariantes e diário append-only.
- `README.md`: visão geral e estrutura.
- `docs/API.md`: contratos de rotas.
- `docs/ARCHITECTURE.md`: fluxos e fronteiras.
- `docs/INFRASTRUCTURE.md`: Apache, systemd, env e deploy.
- `docs/MODELS.md`: catálogo e defaults.
- `BACKLOG.md`: estado das frentes e entregas; L1 está integrada e pronta para revisão, sem FRENTE ativa até decisão de Anders.

## Estado atual

- Next.js 16 com `basePath=/chat`; produção em `chatgpt.service`, porta `3040`.
- Shell único: `GauchoChatShellV2` / `workspace-v2`.
- Tema padrão: Atmosphere Glass (`Midnight Glass` no dark e `Daybreak` no light); tokens de cor são globais para alcançar portals Radix, enquanto a geometria permanece escopada a `.gc-atmosphere-shell`.
- Chat principal via OpenAI Responses API; DeepSeek V4 Pro e Gemini 3.8 Flash usam adapters server-side apenas no chat padrão streaming. GPT-6 Astra está disponível com reasoning e verbosity `medium` fixos.
- Documento, Deepsearch e Quiz continuam em fluxos OpenAI forçados.
- Pulse é a superfície visível de rotinas; Calendar/OAuth permanece backend legado operacional.
- Studio é Python-only (modo Local TS/JS removido em 2026-08-12): workspace no servidor via `/api/studio/workspace/*`, sandbox systemd, step-up auth por `STUDIO_WORKSPACE_PASSWORD`, console com stdin interativo, painéis redimensionáveis, preview de markdown (`Código/Dividido/Preview` em arquivos `.md`), terminal PTY (bash na jail via node-pty + xterm.js, view alternável com Ctrl+`, 1 sessão com idle-kill 30 min e reanexo com replay) e notebook `.ipynb` estilo Colab (view de células com ipykernel real na jail via helper jupyter_client, nbformat v4, outputs ricos png/jpeg/svg/html/latex/markdown sanitizados e persistidos, `input()` inline, Shift/Alt+Enter, mover/inserir células, executar tudo/acima com fila visível, assistente por célula fix/generate, 1 kernel `MemoryMax=2G` com idle-kill 30 min); localStorage guarda só prefs/assistente (snapshot v2).
- Persistência pessoal de produção continua em `data/*.json`; a fundação SQLite Memory V2 está integrada, mas `MEMORY_V2_ENABLED` permanece desligada e nenhum dado real foi migrado. Esses arquivos não são fixtures e não devem ser alterados sem pedido explícito.

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
