# Modelos

**Última atualização:** 2026-09-24
**Fonte:** `lib/models/modelConfig.ts`

## Catálogo Atual

### Chat e Reasoning

| ID | Nome | Família | Reasoning | Contexto | Max output | Badge |
|---|---|---|---|---|---|---|
| `gpt-6-astra` | GPT-6 Astra | `gpt-6` | `medium` fixo | 1.05M | 128K | Mais potente |
| `gpt-6-sol` | GPT-6 Sol | `gpt-6` | Sim (`standard`, até `max`) | 1.05M | 128K | Equilibrado |
| `gpt-6-luna` | GPT-6 Luna | `gpt-6` | Sim (`standard`, até `max`) | 1.05M | 128K | Default |
| `chat-latest` | GPT-5.5 Instant | `gpt-5` | Sim | 400K | 128K | Instant |
| `gpt-5.5` | GPT-5.5 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `grok-4.7` | Grok 4.7 | `grok` | `medium` fixo | 500K | limite local do catálogo | Grok |
| `gpt-5.2` | GPT-5.2 | `gpt-5` | Sim | 400K | 128K | Reasoning |
| `deepseek-v4-pro` | DeepSeek V4 Pro | `deepseek` | Sim (máximo fixo) | 1M | 384K | DeepSeek |
| `gemini-3.8-flash` | Gemini 3.8 Flash | `gemini` | Sim (`low` a `high`) | 1.048M | 65.536 | Gemini |

### Imagem

| ID | Nome | Família | Uso |
|---|---|---|---|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | Tool real de geração de imagem em `/api/chat` |
| `dall-e-3` | DALL-E 3 | `dall-e` | Modelo legado/listado no catálogo |

## Defaults

- Modelo padrão do chat: `gpt-6-luna`, reasoning `low`, modo `standard`.
- `gpt-6-astra` usa reasoning `medium` e verbosity `medium` fixos; store e backend rejeitam overrides desses dois campos.
- `gpt-6-sol` inicia com reasoning `medium`, modo `standard`; Luna inicia com `low`.
- Sol e Luna oferecem effort `max`; o modo `pro` da família GPT-5.6 não é enviado aos modelos GPT-6.
- IDs GPT-5.6 Sol/Luna/Terra salvos são aceitos para leitura e resolvem respectivamente para GPT-6 Sol/Luna/Sol antes de uma nova chamada. Históricos não são reescritos.
- Preços locais estimados de Sol: US$ 2 entrada, US$ 0,20 cache e US$ 10 saída por milhão de tokens; Luna: US$ 0,10/0,01/0,50. Acima de 272 mil tokens de entrada, a tarifa longa vale para o request inteiro. A estimativa local não cobre cache writes, tools ou tiers de processamento; usar Costs da OpenAI para conciliação financeira. [Tabela oficial](https://developers.openai.com/api/docs/pricing).
- `gpt-5.4-mini` é identificador legado: preferências e novas execuções resolvem para `grok-4.7`, sem reescrever mensagens/runs históricos. Grok usa `medium` fixo no cliente e no servidor, com `XAI_API_KEY` ou `GROK_API_KEY` (primeiro tem precedência).
- `gpt-chat-latest` e `gpt-5-chat-latest` são aceitos como aliases locais e resolvem para `chat-latest`.
- `gpt-5.2` inicia com reasoning `medium` + summary `detailed`.
- Modelos mini iniciam com reasoning `none` + summary `detailed`; como o effort começa em `none`, esse summary não é enviado ao backend até o usuário ativar reasoning.
- Modelo de imagem usado pela tool: `gpt-image-2`.
- Quiz força `gpt-5.4` com reasoning `high`.
- Documento e Deepsearch Medium usam `grok-4.7` com reasoning `medium`; Deepsearch High continua em `gpt-5.4` com reasoning `high`.
- O Pulse usa `grok-4.7` + `medium` por padrão e oferece Astra/Sol/Luna como opções OpenAI. Astra mantém reasoning/verbosity `medium`; Sol/Luna usam verbosity `high`; Grok não recebe esse parâmetro. Imagens continuam OpenAI por chamada separada.
- O `fresh_web_context` do DeepSeek usa `gpt-6-luna` + `low`; a resposta final continua no DeepSeek V4 Pro com reasoning máximo.
- `deepseek-v4-pro` é permitido apenas no chat padrão streaming, não usa `code_interpreter` e depende de `DEEPSEEK_API_KEY`.
- `gemini-3.8-flash` inicia em thinking `high`, permite `low`, `medium` e `high`, e depende de `GEMINI_API_KEY`.
- Gemini usa Interactions API stateless (`store=false`) com Google Search e URL Context nativos; os modos especiais usam seus presets, independentemente do seletor do chat.
- Autocomplete FIM do Studio usa `codestral-latest` (Codestral 25.08, Mistral) via `/v1/fim/completions`; a key vem de `CODESTRAL_API_KEY` ou `MISTRAL_API_KEY`, com `deepseek-v4-pro` como fallback legado via `DEEPSEEK_API_KEY`.
- TTS do Chat/Pulse usa a API xAI `/v1/tts` com Orion e MP3; `gpt-4o-mini-tts` em `lib/tts/speechText.ts` permanece para SoundCase e rota legada.
- Realtime opcional do Chat/Pulse usa `grok-voice-latest` com voz Orion; `gpt-realtime-2.1-mini` permanece no SoundCase e na rota legada OpenAI.
- Transcrição usa `gpt-4o-transcribe`.
- SoundCase usa `gpt-6-luna` com reasoning `low` para direção estruturada, `gpt-4o-mini-tts` para chunks do arquivo final, `gpt-realtime-2.1-mini` para escuta imediata e `gpt-image-2` para capa. Texto narrado nunca é reescrito pela etapa de direção.
- O arquivo SoundCase usa MP3 por padrão, com FLAC/WAV por override; o Realtime é transitório e não substitui a versão durável para download.
- SoundCase também oferece `grok-voice-latest` experimental: texto → áudio, sem microfone, com vozes xAI e velocidade entre 0.7x e 1.5x. Preferências independentes da geração de arquivo; engine OpenAI permanece default. Grok 4.7 é o modelo de texto, não o modelo dessa sessão de voz.

Referência do provider: [Grok 4.7](https://docs.x.ai/developers/models/grok-4.7), [Realtime](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech). Preço-base de Grok: US$ 2/6 por milhão de tokens input/output e US$ 0.50 cached; a partir de 200k tokens de entrada, US$ 4/12 e US$ 1 cached. O limiar inclusivo segue o contrato de `long_context_threshold` na [API de modelos](https://docs.x.ai/developers/rest-api-reference/inference/models). Estimativas locais não substituem a fatura, especialmente quando o uso agrega várias rodadas de ferramentas. Voz: US$ 0.08 por minuto de áudio enviado/recebido e US$ 0.004 por mensagem de texto de entrada.

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
