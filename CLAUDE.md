# CLAUDE.md

Este arquivo é a ponte compacta para Claude Code. A autoridade operacional é `AGENTS.md`; não replique aqui changelog, roadmaps encerrados ou arquitetura detalhada.

## Leitura inicial

- `AGENTS.md`: regras locais, estado atual e invariantes; diário append-only em `docs/DIARIO-AGENTS.md`.
- `README.md`: visão geral e estrutura.
- `docs/API.md`: contratos de rotas.
- `docs/ARCHITECTURE.md`: fluxos e fronteiras.
- `docs/INFRASTRUCTURE.md`: Apache, systemd, env e deploy.
- `docs/MODELS.md`: catálogo e defaults.
- `BACKLOG.md`: estado das frentes e entregas; Descobrir IA está integrado na main e publicado para revisão; push aguarda confirmação dos commits anteriores incluídos.

## Estado atual

- Next.js 16 com `basePath=/chat`; produção principal em `https://sonaris.us/chat`, `chatgpt.service`, porta `3040`. Após o corte de 2026-10-11, automações executam somente no novo; antigo permanece ligado com agendadores desabilitados. Estado canônico no BACKLOG e detalhes em docs/INFRASTRUCTURE.md.
- Shell único: `GauchoChatShellV2` / `workspace-v2`.
- `Descobrir IA` é uma página separada em `/discover`, com notícias recentes, capas geradas, interesses e TTS Grok/Orion sob demanda. Studio e Descobrir convivem nos atalhos; workspace Python preservado. Textos usam Sol `medium`/verbosity `high`, com 6–9 parágrafos; timer diário às 08h BRT verifica intervalo de dois dias, com pausa persistente na página e busca manual independente.
- Tema padrão: Atmosphere Glass (`Midnight Glass` no dark e `Daybreak` no light); tokens de cor são globais para alcançar portals Radix, enquanto a geometria permanece escopada a `.gc-atmosphere-shell`.
- Chat principal via OpenAI Responses API; DeepSeek V4.1 Flash (`deepseek-flash`, só texto) e Gemini 3.8 Flash usam adapters server-side apenas no chat padrão streaming. GPT-6 Astra está disponível com reasoning e verbosity `medium` fixos.
- Defaults por seção: chat, Documento (fallback de DeepSeek/Gemini), Studio e SoundCase em `gpt-6-luna` + `medium`; Pulse em `gpt-6.1-sol` + `medium`; Deepsearch Medium em Luna `medium` e High em 6.1 Sol `high`; Quiz permanece em `gpt-5.4`; extrações internas (agenda e rotina por texto) em Luna `low`. GPT-5.6 Sol voltou com modo Pro no chat, Pulse e Studio. Grok saiu dos modelos de texto em 2026-10-13: IDs Grok/mini resolvem para Luna, 6 Sol/Terra para 6.1 Sol, sem reescrever históricos; a chave xAI ficou só para voz.
- SoundCase oferece voz Grok Realtime experimental somente para leitura de texto, com token temporário no navegador; TTS e arquivo OpenAI permanecem. QA isolado usa `GAUCHO_ISOLATED_RUNTIME=true`, que desabilita Studio real sem dispensar auth ou locks; cleanup wildcard foi substituído pelo vínculo das novas sessões ao serviço proprietário validado.
- Pulse é a superfície visível de rotinas; Calendar/OAuth permanece backend legado operacional.
- Studio é Python-only (modo Local TS/JS removido em 2026-08-12): workspace no servidor via `/api/studio/workspace/*`, sandbox systemd, step-up auth por `STUDIO_WORKSPACE_PASSWORD`, console com stdin interativo, painéis redimensionáveis, preview de markdown (`Código/Dividido/Preview` em arquivos `.md`), terminal PTY (bash na jail via node-pty + xterm.js, view alternável com Ctrl+`, 1 sessão com idle-kill 30 min e reanexo com replay) e notebook `.ipynb` estilo Colab (view de células com ipykernel real na jail via helper jupyter_client, nbformat v4, outputs ricos png/jpeg/svg/html/latex/markdown sanitizados e persistidos, `input()` inline, Shift/Alt+Enter, mover/inserir células, executar tudo/acima com fila visível, assistente por célula fix/generate, 1 kernel `MemoryMax=2G` com idle-kill 30 min); localStorage guarda só prefs/assistente (snapshot v2). O painel do assistente pode usar web search e preserva citações; o modo célula continua sem tools.
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
- `https://sonaris.us/chat/api/health`

Preserve mudanças locais não relacionadas. Atualize o documento canônico correspondente quando alterar API, arquitetura, modelos ou infraestrutura.
