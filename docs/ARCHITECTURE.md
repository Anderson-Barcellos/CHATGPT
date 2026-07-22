# Arquitetura

**Última atualização:** 2026-07-17

## Visão Geral

Gaucho Chat é um app Next.js com App Router que roda como BFF local para providers de IA. O fluxo principal usa a OpenAI `Responses API`; o chat padrão também pode usar DeepSeek V4 Pro via adapter server-side. O cliente React conversa apenas com rotas do próprio app; essas rotas cuidam de auth, rate limit, persistência local e chamadas server-side.

```text
Browser/PWA
  -> Next.js UI em /chat
  -> proxy.ts: auth, rate limit e headers
  -> app/api/*: BFF server-side
  -> OpenAI/DeepSeek APIs e JSON store local
```

## Entrada e Shell

- `app/page.tsx` é a entrada autenticada e renderiza `GauchoChatShellV2`.
- `components/workspace-v2/*` contém o shell ativo: rail de conversas, canvas central, composer, painel de atividade/notas e preview de artifacts.
- `components/chat/*` concentra rendering de mensagens, markdown, reasoning, quick actions, TTS e export.
- `components/settings/*` concentra persona, prompt principal visível, memórias, sugestões/RAG, tuning e preferências de voz.

O shell legado foi removido. Novas mudanças de UI devem seguir `workspace-v2`, tokens `--gc-*` em `app/globals.css` e os padrões atuais de componentes Radix/lucide.

### Densidade visual mobile

A compactação mobile atual foi implementada como uma passada paralela ao fluxo Codex de refinamentos. Abaixo de `md`, o app usa tokens `--gc-mobile-*` em `app/globals.css` para reduzir em torno de 15% o sistema espacial do shell: frame, header, subheader, composer, área do chat, empty state, painel contextual, rail e settings. A regra é compactar espaçamento, altura, raio e agrupamento; não usar `zoom`, viewport artificial ou `transform: scale()` global, e não escalar tipografia de leitura por viewport.

Na harmonização mais recente, o contrato mobile ficou ainda mais explícito no composer: header, footer e textarea usam tokens semânticos (`--gc-mobile-header-*`, `--gc-mobile-composer-*`, `--gc-mobile-textarea-*`), e a linha principal concentra anexos, modelo, reasoning, pesquisa, `Rec` e envio. Em vez de uma segunda faixa fixa de anexos, o mobile agora usa um menu único de paperclip com `Arquivo` e `Imagem`, liberando mais área útil para a sessão do chat.

## Fluxo de Chat

1. O composer chama `useChat`.
2. `useChat` monta payload com mensagens, anexos, persona, modelo e opções.
3. `POST /api/chat` valida auth, body e modelo.
4. A rota chama `openai.responses.create()` com streaming quando aplicável, ou o adapter DeepSeek quando o modelo é `deepseek-v4-pro`.
5. Eventos SSE passam pelo reducer em `lib/chat/streamMachine.ts`.
6. A mensagem do assistente é atualizada incrementalmente e persistida durante o stream.

Detalhes importantes:

- O body do chat é limitado a aproximadamente 10 MB.
- Desconexões do cliente abortam também a chamada upstream.
- Respostas interrompidas são preservadas e voltam como `streamStatus="interrupted"`.
- Anexos persistidos mantêm conteúdo real para reload/edit/resend.

### DeepSeek V4 Pro

`deepseek-v4-pro` é um provider separado para chat padrão streaming. Ele passa por `lib/server/deepseekChat.ts`, exige `DEEPSEEK_API_KEY`, força reasoning máximo no payload DeepSeek, não suporta `code_interpreter` e rejeita modos `document`, `deepsearch_*` e `quiz`.

O adapter expõe uma tool local `fresh_web_context`. Quando o DeepSeek chama essa tool, o servidor faz uma chamada OpenAI curta com `web_search_preview` usando `DEEPSEEK_WEB_CONTEXT_MODEL` ou `gpt-5.6-luna`, injeta o resultado como mensagem de tool e continua um segundo turno DeepSeek sem expor chaves ao browser.

## Reasoning

O reasoning é montado em `lib/chat/reasoningConfig.ts` e usado por `hooks/useChat.ts`.
Modelos sem capacidade de reasoning, ou effort `none`, não enviam `reasoning` no payload.
Para efforts ativos (`low`, `medium`, `high`, `xhigh`), o payload preserva a preferência
`reasoningSummary`; o valor local `off` vira omissão do campo `summary`, pois a API aceita
apenas `auto`, `concise` e `detailed`.

Na UI, `ReasoningPanel` aparece quando há summary/texto de reasoning ou quando
`response.completed.usage.output_tokens_details.reasoning_tokens` confirma que houve
raciocínio sem summary textual. Isso evita esconder reasoning usado e cobrado quando a API
não emite eventos `reasoning_summary_*`.

Eventos de stream reconhecidos para reasoning:

- `response.reasoning_summary_text.delta`
- `response.reasoning_summary_text.done`
- `response.reasoning_summary_part.done`
- `response.reasoning_text.done`

## Auth e Proxy

`proxy.ts` é o middleware do Next 16. Ele:

- remove o `basePath` antes de comparar rotas;
- deixa públicos `/login`, `/api/auth/*`, `/api/health`, `_next` e assets;
- aplica rate limit em `/api/chat`, `/api/transcribe`, `/api/auth/login`, início de OAuth Google, agenda e notas locais;
- retorna `401` JSON para APIs privadas sem sessão;
- redireciona páginas privadas para `/login`.

`app/page.tsx` faz uma segunda checagem server-side antes de renderizar o shell.

Auth é controlada por:

- `AUTH_ENABLED`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `JWT_SECRET`

O cookie de sessão é `auth-token`, assinado com JWT HS256, `HttpOnly`, `SameSite=Lax`, TTL de 7 dias e path derivado de `NEXT_PUBLIC_BASE_PATH`.

## Persistência

Persistência server-side simples:

- `data/conversations.json`
- `data/chat-background-jobs.json` (metadados pendentes/terminais de Documento/Deepsearch em background)
- `data/memories.json`
- `data/persona.json`
- `data/memory-index` como índice vetorial local LanceDB para memória/RAG
- `data/pulse-tasks.json` e `data/pulse-runs.json` (runtime privado do Pulse)
- `data/calendar-event-drafts.json` (runtime privado, ignorado pelo Git)
- `data/workspace-notes.json` (runtime privado, ignorado pelo Git)
- `data/google-calendar-token.json` (runtime privado, criptografado e ignorado pelo Git)

Camadas principais:

- `lib/storage/conversations.ts`: CRUD e beacon para conversas.
- `lib/server/chatBackgroundJobStore.ts`: metadados de jobs `document`/`deepsearch_*` para reconciliação após reload ou suspensão mobile.
- `lib/storage/memories.ts`: CRUD de memórias.
- `app/api/persona/route.ts`: persona, instruções customizadas e `ttsPreferences`.
- `app/api/memory/*` e `lib/server/memory/*`: indexação semântica com `text-embedding-3-small`, busca RAG, sugestões e execução das memory tools.
- `lib/storage/conversationPersistence.ts`: retry/normalização de writes.

O cliente também usa stores Zustand e cache local, mas o estado canônico compartilhável fica no servidor JSON.

## Prompt, Persona e Memória

O prompt efetivo é montado em `lib/openai/contextBuilder.ts`:

- `BASE_SYSTEM_PROMPT`, vindo de `lib/prompts/systemPrompt.ts`;
- `FIXED_PERSONA_PROMPT`, vindo de `lib/prompts/personaPrompt.ts`;
- prompt extra do seletor (`parameters.systemPrompt`), quando houver;
- `contextAboutUser`, `responsePreferences` e `customSystemInstructions` de `/api/persona`;
- memórias ativas de `data/memories.json`;
- contexto recuperado do RAG local quando `useChat.ts` chama `searchMemoryContext`.

Na aba Persona, `SettingsDrawer` mostra `BASE_SYSTEM_PROMPT + FIXED_PERSONA_PROMPT` como prévia somente leitura e deixa editáveis os campos persistidos em `/api/persona`.

Em `responseMode="default"`, `lib/server/chatRequest.ts` também expõe `remember_memory` e `search_memory` como function tools. `lib/server/chatToolOrchestrator.ts` executa até duas rodadas de function-call/output para salvar memória explícita ou buscar histórico quando o modelo usar essas tools sob a policy injetada pelo `contextBuilder`.

## Pulse Nativo

A aba Rotinas substitui a superfície visível de Agenda. Ela cria rotinas recorrentes próprias do Gaucho Chat, sem depender de Google Calendar/Gmail/OAuth. As gerações resultantes aparecem na aba Pulse, que é a aba principal do painel operacional.

- `POST /api/pulse/tasks/propose` usa Responses API com JSON schema para transformar linguagem natural em proposta de rotina.
- `POST /api/pulse/tasks` persiste rotinas `daily`, `weekly` ou `monthly` em `data/pulse-tasks.json`.
- `POST /api/pulse/run-due` é chamado pelo `chatgpt-pulse.timer` e executa tarefas vencidas.
- Cada rotina Pulse escolhe `gpt-5.4-mini` (padrão) ou `gpt-5.6-terra` (experimental), ambos com reasoning `medium`, verbosity `high`, `web_search_preview` e `image_generation`. O modelo/effort efetivos ficam gravados no run; `PULSE_RUN_MODEL` e `PULSE_REASONING_EFFORT` ainda podem sobrepor operacionalmente. O orçamento padrão é `PULSE_MAX_OUTPUT_TOKENS=25000`, com clamp do runner entre 8k e 32k; `none` e `minimal` sobem para `low` com tools.
- O prompt de execução do Pulse usa um contexto enxuto proprio: instruções da rotina, preferencias uteis de `persona.json`, ate 5 memorias ativas compactadas e 3 trechos relevantes do histórico via `searchMemoryContext`. Ele evita injetar o prompt global completo do chat para reduzir latencia e tokens.
- Se a resposta principal não trouxer `image_generation`, o runner tenta uma segunda chamada curta para gerar a imagem conceitual de abertura do card.
- Resultados de Pulse e balões do chat reutilizam `MiniAudioPlayer`, que abre com `useAssistantTts` e `/api/tts` (`gpt-4o-mini-tts`) selecionados, mas não inicia áudio automaticamente.
- O mesmo mini-player permite trocar manualmente para o Realtime 2.1 mini (`/api/realtime/tts-call`); trocar de engine interrompe qualquer reprodução anterior.

## Agenda Google e Notas Locais Legadas

A V1 de agenda Google segue no código como legado operacional, mas não é mais a experiência visível principal do painel. Ela usa Google Calendar API diretamente no backend Next, sem connector externo e sem expor tokens ao browser.

- OAuth começa em `/api/integrations/google/auth/start` e volta por `/api/integrations/google/auth/callback`.
- O callback valida cookie `google-oauth-state` HttpOnly antes de trocar `code` por tokens.
- `lib/google/tokenStore.ts` salva tokens criptografados com AES-256-GCM e exige `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- `GET /api/calendar/events` lista eventos usando o token conectado.
- `POST /api/calendar/events/draft` cria apenas rascunho local.
- `POST /api/calendar/events/draft-from-text` extrai um rascunho local a partir de linguagem natural do chat ou STT.
- `PATCH /api/calendar/events/drafts/[id]` e `POST /api/calendar/events/drafts/[id]/discard` revisam ou descartam rascunhos locais pendentes sem tocar no Google.
- `POST /api/calendar/events/confirm` é o único caminho que escreve no Google Calendar.

Notas locais globais ficam em `/api/workspace-notes` e não substituem `workspace.notes` por conversa. A camada local serve para capturas manuais, trechos do chat, STT via `/api/transcribe` e vínculos opcionais com evento/conversa.

## Artifacts e Export

Artifacts são gerados a partir das respostas e exibidos pelo `ArtifactPreviewSheet`.

Fluxos relevantes:

- Documentos e quizzes têm preview; documentos expõem download de fonte e exportação PDF.
- A opção de imprimir não faz parte do painel A4 atual.
- PDF de documento usa `/api/artifacts/pdf` com Playwright/Chrome server-side.
- O template PDF usa fonte Lexend embutida, JavaScript desativado, links HTTP impressos no corpo e cabeçalho compacto com ícone OpenAI + título. O bloco antigo de metadados (`Gaucho Chat`, exportado em, formato PDF A4) não deve voltar sem decisão explícita.
- Preview HTML no cliente permanece aceito para uso pessoal do app.

## Voz

O TTS padrão usa `/api/tts` com `gpt-4o-mini-tts`.

- Texto é sanitizado e dividido em chunks em `lib/tts/speechText.ts`.
- `hooks/useAssistantTts.ts` faz cache em memória, fila turbo e controle de playback.
- `ttsPreferences.format` controla `response_format` (`flac` por padrão, com `mp3` e `wav` disponíveis); download completo fica habilitado apenas em `mp3` porque chunks `flac`/`wav` não devem ser concatenados como um arquivo único.
- `/api/realtime/tts-call` segue como caminho experimental com `gpt-realtime-2.1-mini` via SDP/WebRTC. Chat e Pulse expõem um único alto-falante que abre `MiniAudioPlayer`; dentro dele, o usuário alterna entre TTS padrão e Realtime 2.1. O payload não define `max_output_tokens`, deixando o Realtime usar o default `inf` do contrato GA.

## Modelos

O catálogo vive em `lib/models/modelConfig.ts`. O default do chat é `gpt-5.6-luna` com reasoning `low` e modo `standard`; modelos removidos conhecidos e seleções antigas de `gpt-5.4-mini` caem para Luna. `gpt-5.6-sol` inicia em `medium/standard`; Sol e Luna aceitam modo `pro` independente do effort e effort `max`. O Mini permanece registrado para compatibilidade e fluxos internos, porque Pulse e Deepsearch ainda o usam. `responseMode="quiz"` força `gpt-5.4/high`; Deepsearch Medium usa `gpt-5.4-mini/high` e High usa `gpt-5.4/high`. O contexto web auxiliar do DeepSeek usa `gpt-5.6-luna/low` antes da síntese no DeepSeek V4 Pro.

Tools padrão:

- `responseMode="default"`: `image_generation`, `web_search_preview`, `remember_memory`, `search_memory` e `code_interpreter` opcional.
- `document` e `deepsearch_*`: `web_search_preview` e `code_interpreter` opcional, sem `image_generation`; o fluxo principal usa background sync.
- `quiz`: sem tools, com schema JSON estrito.

## Regras Quebráveis

- Não trocar `Responses API` por `chat.completions`.
- Não adicionar rewrite com barra final para `/chat`.
- Não mudar `NEXT_PUBLIC_BASE_PATH=/chat` sem atualizar Apache, systemd e helpers.
- Não colocar `artifact.id` na key dos balões; a key estável é `message.id`.
- Não documentar valores reais de `.env.production` ou `.env.local`.
