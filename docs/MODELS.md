# Modelos

**Última atualização:** 2026-09-03
**Fonte:** `lib/models/modelConfig.ts`

## Catálogo Atual

### Chat e Reasoning

| ID | Nome | Família | Reasoning | Contexto | Max output | Badge |
|---|---|---|---|---|---|---|
| `gpt-6-astra` | GPT-6 Astra | `gpt-6` | `medium` fixo | 1.05M | 128K | Mais potente |
| `gpt-5.6-sol` | GPT-5.6 Sol | `gpt-5` | Sim (`standard`/`pro`, até `max`) | 1.05M | 128K | Mais potente |
| `gpt-5.6-terra` | GPT-5.6 Terra | `gpt-5` | Sim (`standard`/`pro`, até `max`) | 1.05M | 128K | Equilibrado |
| `gpt-5.6-luna` | GPT-5.6 Luna | `gpt-5` | Sim (`standard`/`pro`, até `max`) | 400K | 128K | Default |
| `chat-latest` | GPT-5.5 Instant | `gpt-5` | Sim | 400K | 128K | Instant |
| `gpt-5.5` | GPT-5.5 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4-mini` | GPT-5.4 mini | `gpt-5` | Sim | 128K | 16K | Eficiente |
| `gpt-5.2` | GPT-5.2 | `gpt-5` | Sim | 400K | 128K | Reasoning |
| `deepseek-v4-pro` | DeepSeek V4 Pro | `deepseek` | Sim (máximo fixo) | 1M | 384K | DeepSeek |
| `gemini-3.8-flash` | Gemini 3.8 Flash | `gemini` | Sim (`low` a `high`) | 1.048M | 65.536 | Gemini |

### Imagem

| ID | Nome | Família | Uso |
|---|---|---|---|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | Tool real de geração de imagem em `/api/chat` |
| `dall-e-3` | DALL-E 3 | `dall-e` | Modelo legado/listado no catálogo |

## Defaults

- Modelo padrão do chat: `gpt-5.6-luna`, reasoning `low`, modo `standard`.
- `gpt-6-astra` usa reasoning `medium` e verbosity `medium` fixos; store e backend rejeitam overrides desses dois campos.
- `gpt-5.6-sol` inicia com reasoning `medium`, modo `standard`.
- `gpt-5.6-terra` inicia com reasoning `medium`, modo `standard`.
- Sol, Terra e Luna aceitam `reasoning.mode="pro"` independentemente do effort e oferecem effort `max`.
- `gpt-5.4-mini` permanece permitido e no catálogo; uma seleção salva válida é preservada, e Pulse/Deepsearch também usam Mini internamente.
- `gpt-chat-latest` e `gpt-5-chat-latest` são aceitos como aliases locais e resolvem para `chat-latest`.
- `gpt-5.2` inicia com reasoning `medium` + summary `detailed`.
- Modelos mini iniciam com reasoning `none` + summary `detailed`; como o effort começa em `none`, esse summary não é enviado ao backend até o usuário ativar reasoning.
- Modelo de imagem usado pela tool: `gpt-image-2`.
- Quiz força `gpt-5.4` com reasoning `high`.
- Deepsearch Medium usa `gpt-5.4-mini` com reasoning `high`; Deepsearch High usa `gpt-5.4` com reasoning `high`.
- O Pulse usa `gpt-5.4-mini` + `medium` por padrão e permite `gpt-5.6-sol` ou `gpt-5.6-terra` por rotina; todos usam verbosity `high`.
- O `fresh_web_context` do DeepSeek usa `gpt-5.6-luna` + `low`; a resposta final continua no DeepSeek V4 Pro com reasoning máximo.
- `deepseek-v4-pro` é permitido apenas no chat padrão streaming, não usa `code_interpreter` e depende de `DEEPSEEK_API_KEY`.
- `gemini-3.8-flash` inicia em thinking `high`, permite `low`, `medium` e `high`, e depende de `GEMINI_API_KEY`.
- Gemini usa Interactions API stateless (`store=false`) com Google Search e URL Context nativos; Documento, Deepsearch e Quiz continuam nos modelos OpenAI forçados.
- Autocomplete FIM do Studio usa `codestral-latest` (Codestral 25.08, Mistral) via `/v1/fim/completions`; a key vem de `CODESTRAL_API_KEY` ou `MISTRAL_API_KEY`, com `deepseek-v4-pro` como fallback legado via `DEEPSEEK_API_KEY`.
- TTS usa `gpt-4o-mini-tts` em `lib/tts/speechText.ts`.
- Realtime TTS opcional usa `gpt-realtime-2.1-mini`, sem `max_output_tokens` explícito.
- Transcrição usa `gpt-4o-transcribe`.
- SoundCase usa `gpt-5.6-luna` com reasoning `low` para direção estruturada, `gpt-4o-mini-tts` para chunks do arquivo final, `gpt-realtime-2.1-mini` para escuta imediata e `gpt-image-2` para capa. Texto narrado nunca é reescrito pela etapa de direção.
- O arquivo SoundCase usa MP3 por padrão, com FLAC/WAV por override; o Realtime é transitório e não substitui a versão durável para download.

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
- envia `reasoning.mode="pro"` somente em Sol/Terra/Luna; `standard` é omitido por ser o default da API;
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
