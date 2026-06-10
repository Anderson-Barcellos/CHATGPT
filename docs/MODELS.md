# Modelos

**Última atualização:** 2026-05-31
**Fonte:** `lib/models/modelConfig.ts`

## Catálogo Atual

### Chat e Reasoning

| ID | Nome | Família | Reasoning | Contexto | Max output | Badge |
|---|---|---|---|---|---|---|
| `gpt-5.5` | GPT-5.5 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4-mini` | GPT-5.4 mini | `gpt-5` | Sim | 128K | 16K | Eficiente |
| `gpt-5.2` | GPT-5.2 | `gpt-5` | Sim | 400K | 128K | Reasoning |

### Imagem

| ID | Nome | Família | Uso |
|---|---|---|---|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | Tool real de geração de imagem em `/api/chat` |
| `dall-e-3` | DALL-E 3 | `dall-e` | Modelo legado/listado no catálogo |

## Defaults

- Modelo padrão do chat: `gpt-5.4-mini`.
- `gpt-5.2` inicia com reasoning `medium` + summary `detailed`.
- Modelos mini iniciam com reasoning `none` + summary `detailed`; como o effort começa em `none`, esse summary não é enviado ao backend até o usuário ativar reasoning.
- Modelo de imagem usado pela tool: `gpt-image-2`.
- Quiz força `gpt-5.4` com reasoning `high`.
- No shell atual, Deepsearch Medium/High envia `gpt-5.4-mini` com reasoning `medium/high`.
- TTS usa `gpt-4o-mini-tts` em `lib/tts/speechText.ts`.
- Realtime TTS lab usa `gpt-realtime-mini`.
- Transcrição usa `gpt-4o-transcribe`.

## Regras de Runtime

`app/api/chat/route.ts`:

- aceita apenas modelos com capacidade `chat` ou `reasoning`;
- limita `maxOutputTokens` ao `maxOutput` do modelo;
- só envia `temperature` e `top_p` quando `modelSupportsTemperature()` permite;
- só envia `verbosity` quando `modelSupportsVerbosity()` permite;
- só adiciona `code_interpreter` quando o usuário habilita e o modelo suporta.
- faz enforcement rígido apenas para `responseMode="quiz"`; presets `document` e `deepsearch_*` são montados no app por `hooks/useChat.ts`.

`lib/chat/reasoningConfig.ts`:

- não envia reasoning quando o modelo não tem capacidade `reasoning`;
- não envia reasoning quando o effort é `none`;
- repassa `low`, `medium`, `high` e `xhigh` como `reasoning.effort`;
- repassa `auto`, `concise` e `detailed` como `reasoning.summary`;
- converte a preferência local `summary=off` em omissão do campo, evitando valor inválido na Responses API.

Observação de UI: reasoning pode ser aplicado sem summary textual no stream. Quando
`response.completed` traz `reasoning_tokens`, o balão mantém um estado visível de
"raciocínio aplicado" mesmo se não houver eventos `reasoning_summary_*`.

Tools padrão em modos não-quiz:

- `image_generation`
- `web_search_preview`
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
