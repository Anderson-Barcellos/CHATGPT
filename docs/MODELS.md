# Modelos

**Última atualização:** 2026-10-24
**Fonte:** `lib/models/modelConfig.ts`

## Catálogo Atual

Sonnet 5.5 (`claude-sonnet-5-5`) e Opus 5.5 (`claude-opus-5-5`) entram somente no chat padrão. Ambos começam em `medium` e oferecem `low`, `medium` e `high`, com teto aplicado também no backend. Contexto de 1M e saída máxima de 128K; preços por milhão de tokens (entrada/cache read/saída): Sonnet US$ 2/0,10/10, Opus US$ 4/0,20/20. São estimativas de tokens, não uma fatura completa de ferramentas ou cache writes. Fontes: [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview).

Astra e Gemini permanecem no catálogo para compatibilidade, mas deixam as novas escolhas do chat. Preferências antigas desses modelos no chat passam a Luna `medium`, sem reescrever históricos. Astra permanece no Studio e no Pulse. Claude suporta imagens de entrada, web search/fetch e as ferramentas de memória do Gaúcho; não oferece geração de imagens, code interpreter ou modo Pro. Documento com Claude usa Luna `medium`; Deepsearch e Quiz mantêm seus presets.

### Chat e Reasoning

| ID | Nome | Família | Reasoning | Contexto | Max output | Badge |
|---|---|---|---|---|---|---|
| `gpt-6-astra` | GPT-6 Astra | `gpt-6` | `medium` fixo | 1.05M | 128K | Mais potente |
| `gpt-6.1-sol` | GPT-6.1 Sol | `gpt-6` | Sim (`low` a `max`, sem `none`) | 1.05M | 128K | Equilibrado |
| `gpt-6-luna` | GPT-6 Luna | `gpt-6` | Sim (`standard`, até `max`) | 1.05M | 128K | Default |
| `gpt-5.6-sol` | GPT-5.6 Sol | `gpt-5` | Sim (`standard` e `pro`, até `max`) | 1.05M | 128K | Pro |
| `chat-latest` | GPT-5.5 Instant | `gpt-5` | Sim | 400K | 128K | Instant |
| `gpt-5.5` | GPT-5.5 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.2` | GPT-5.2 | `gpt-5` | Sim | 400K | 128K | Reasoning |
| `deepseek-flash` | DeepSeek V4.1 Flash | `deepseek` | Sim (`low` fixo no código) | 1M | 384K | DeepSeek |
| `gemini-3.8-flash` | Gemini 3.8 Flash | `gemini` | Sim (`low` a `high`) | 1.048M | 65.536 | Gemini |

### Imagem

| ID | Nome | Família | Uso |
|---|---|---|---|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | Tool real de geração de imagem em `/api/chat` |
| `dall-e-3` | DALL-E 3 | `dall-e` | Modelo legado/listado no catálogo |

## Defaults

- Modelo padrão do chat: `gpt-6-luna`, reasoning `medium`, modo `standard`. A preferência persistida (`gaucho-chat:settings`, v2) migrou uma vez o `low` antigo do Luna para `medium`; um `low` escolhido depois é respeitado.
- `gpt-6-astra` usa reasoning `medium` e verbosity `medium` fixos; store e backend rejeitam overrides desses dois campos.
- `gpt-6.1-sol` e `gpt-6-luna` iniciam com reasoning `medium`, modo `standard`. O 6.1 Sol recusa `none` na API (400); um `none` salvo volta para `medium`.
- Sol e Luna oferecem effort `max`; o modo `pro` só existe no `gpt-5.6-sol` e não é enviado aos modelos GPT-6.
- `gpt-5.6-sol` voltou em 2026-10-13 como modelo próprio (chat, Pulse e Studio), com modo `pro`. IDs `gpt-6-sol` e `gpt-5.6-terra` salvos resolvem para `gpt-6.1-sol`, e `gpt-5.6-luna` para `gpt-6-luna`, antes de uma nova chamada. Históricos não são reescritos.
- Preços locais estimados do 6.1 Sol: US$ 2 entrada, US$ 0,10 cache e US$ 10 saída por milhão de tokens; acima de 272 mil tokens de entrada, US$ 4/0,20/15 para o request inteiro. Luna: US$ 0,10/0,01/0,50. GPT-5.6 Sol: US$ 5/0,50/30. DeepSeek V4.1 Flash: US$ 0,30/0,006/1,20 na tarifa de pico (fora do pico a DeepSeek cobra metade). A estimativa local não cobre cache writes, tools ou tiers de processamento; usar Costs da OpenAI para conciliação financeira. [Tabela oficial](https://developers.openai.com/api/docs/pricing).
- `gpt-5.4-mini` e `grok-4.7` são identificadores legados: preferências, rotinas e novas execuções resolvem para `gpt-6-luna`, sem reescrever mensagens/runs históricos. O Grok saiu do chat, do Pulse e do Studio em 2026-10-13; jobs background xAI já persistidos só são finalizados (cancelamento ou recuperação), nunca reexecutados.
- `deepseek-v4-pro` é identificador legado e resolve para `deepseek-flash`.
- `gpt-chat-latest` e `gpt-5-chat-latest` são aceitos como aliases locais e resolvem para `chat-latest`.
- `gpt-5.2` inicia com reasoning `medium` + summary `detailed`.
- Modelos mini iniciam com reasoning `none` + summary `detailed`; como o effort começa em `none`, esse summary não é enviado ao backend até o usuário ativar reasoning.
- Modelo de imagem usado pela tool: `gpt-image-2`.
- Quiz força `gpt-5.4` com reasoning `high`.
- Documento segue o modelo do chat; com DeepSeek ou Gemini selecionados cai para `gpt-6-luna` + `medium` (`lib/chat/documentConfig.ts`). Deepsearch Medium usa `gpt-6-luna` + `medium` e Deepsearch High usa `gpt-6.1-sol` + `high` (`lib/chat/deepsearchConfig.ts`). Quiz continua em `gpt-5.4` com reasoning `high`.
- O Pulse usa `gpt-6.1-sol` + `medium` por padrão em rotinas novas e oferece Astra, Luna e GPT-5.6 Sol como opções; rotinas salvas com 6 Sol/Terra passam a rodar no 6.1 Sol e as com Grok/mini no Luna. Astra mantém reasoning/verbosity `medium`; os demais usam verbosity `high`. Imagens continuam OpenAI.
- As extrações internas (rascunho de agenda em linguagem natural e criação de rotina Pulse por texto) usam `gpt-6-luna` + `low` via OpenAI; `CALENDAR_DRAFT_MODEL` e `PULSE_EXTRACT_MODEL` aceitam vazio, `gpt-6-luna` ou os legados `gpt-5.4-mini`/`grok-4.7`.
- O `fresh_web_context` do DeepSeek usa `gpt-6-luna` + `low`; o código do adaptador fixa a resposta final do DeepSeek V4.1 Flash em `low`. Desde a publicação de 2026-10-27 (build `v33VHEZLnntZ8uAp4lyOi`), produção e git usam o mesmo `low`; a divergência `max` das publicações anteriores terminou. O Flash está habilitado só para texto neste chat (imagem anexada retorna erro).
- `deepseek-flash` é permitido apenas no chat padrão streaming, não usa `code_interpreter` e depende de `DEEPSEEK_API_KEY`.
- `gemini-3.8-flash` inicia em thinking `high`, permite `low`, `medium` e `high`, e depende de `GEMINI_API_KEY`.
- Gemini usa Interactions API stateless (`store=false`) com Google Search e URL Context nativos; os modos especiais usam seus presets, independentemente do seletor do chat.
- O assistente do Studio usa `gpt-6-luna` por padrão, com reasoning `medium` em qualquer modelo (Astra, 6.1 Sol, Luna ou 5.6 Sol), no painel e no modo célula.
- Autocomplete FIM do Studio usa `codestral-latest` (Codestral 25.08, Mistral) via `/v1/fim/completions`; a key vem de `CODESTRAL_API_KEY` ou `MISTRAL_API_KEY`, com `deepseek-flash` como fallback legado via `DEEPSEEK_API_KEY`.
- TTS do Chat/Pulse usa a API xAI `/v1/tts` com Orion e MP3; `gpt-4o-mini-tts` em `lib/tts/speechText.ts` permanece como opção do SoundCase e rota legada.
- Realtime opcional do Chat/Pulse usa `grok-voice-latest` com voz Orion; `gpt-realtime-2.1-mini` permanece no SoundCase e na rota legada OpenAI.
- Ditado ao vivo usa `gpt-live-transcribe`, português, delay `low`, PCM16 mono a 24 kHz e commits explícitos por pausa. `gpt-4o-transcribe` permanece no fallback HTTP após a gravação. Sem seletor novo; TTS preservado.
- SoundCase usa `gpt-6-luna` com reasoning `medium` para direção estruturada, xAI `/v1/tts` (Grok TTS, Orion inicial) ou `gpt-4o-mini-tts` para chunks do arquivo final, e `gpt-image-2` para capa. Texto narrado nunca é reescrito pela etapa de direção. A escuta imediata tem escolha independente entre OpenAI Realtime (`gpt-realtime-2.1-mini`) e Grok Realtime.
- O arquivo SoundCase usa MP3 por padrão, com FLAC/WAV por override; o Realtime é transitório e não substitui a versão durável para download.
- SoundCase também oferece `grok-voice-latest` experimental: texto → áudio, sem microfone, com vozes xAI e velocidade entre 0.7x e 1.5x. Preferências da leitura ao vivo são independentes da geração de arquivo; engine OpenAI permanece default para Realtime.

Referência do provider de voz: [Realtime](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech). Voz: US$ 0.08 por minuto de áudio enviado/recebido e US$ 0.004 por mensagem de texto de entrada. A chave xAI (`XAI_API_KEY` ou `GROK_API_KEY`) segue em uso só para TTS e Realtime.

## Regras de Runtime

`app/api/chat/route.ts`:

- aceita apenas modelos com capacidade `chat` ou `reasoning`;
- limita `maxOutputTokens` ao `maxOutput` do modelo;
- só envia `temperature` e `top_p` quando `modelSupportsTemperature()` permite;
- só envia `verbosity` quando `modelSupportsVerbosity()` permite;
- só adiciona `code_interpreter` quando o usuário habilita e o modelo suporta.
- faz enforcement rígido apenas para `responseMode="quiz"`; presets `document` e `deepsearch_*` são montados no app por `hooks/useChat.ts`.
- força reasoning e verbosity `medium` para `gpt-6-astra`, mesmo se o cliente enviar outros valores;
- roteia `gemini-3.8-flash` para o adapter Interactions API apenas em chat padrão streaming.

`lib/chat/reasoningConfig.ts`:

- não envia reasoning quando o modelo não tem capacidade `reasoning`;
- não envia reasoning quando o effort é `none`;
- repassa `minimal`, `low`, `medium`, `high` e `xhigh` como `reasoning.effort` quando o modelo selecionado suporta o nível;
- repassa também `max` nos modelos compatíveis, embora o Astra permaneça travado em `medium` neste app;
- não envia `reasoning.mode="pro"` a GPT-6 Sol/Luna; `standard` é omitido por ser o default da API;
- repassa `auto`, `concise` e `detailed` como `reasoning.summary`;
- converte a preferência local `summary=off` em omissão do campo, evitando valor inválido na Responses API.

Observação de UI: reasoning pode ser aplicado sem summary textual no stream. Quando
`response.completed` traz `reasoning_tokens`, o balão mantém um estado visível de
"raciocínio aplicado" mesmo se não houver eventos `reasoning_summary_*`.

Tools padrão por modo:

- `image_generation` apenas em `responseMode="default"`
- `remember_memory` e `search_memory` apenas em `responseMode="default"`
- `web_search_preview` em modos não-quiz
- `code_interpreter` opcional

## Helpers Exportados

`lib/models/modelConfig.ts` exporta:

- `isReasoningModel`
- `getReasoningLabel`
- `modelSupportsTemperature`
- `modelSupportsVerbosity`
- `modelSupportsCodeInterpreter`
- `calculateCost`
- `estimateCost`
- `fitsInContextWindow`
- `getModelsByCapability`
- `getModelsByFamily`
- `getChatModels`
- `formatCost`
- `formatTokenCount`

## Checklist Para Alterar Modelos

1. Atualizar `MODELS` em `lib/models/modelConfig.ts`.
2. Atualizar `types/index.ts` se entrar uma nova família.
3. Revisar defaults em `stores/settingsStore.ts` e `app/api/chat/route.ts`.
4. Atualizar este documento.
5. Rodar `npm test`, `npx tsc --noEmit` e `npm run build`.
