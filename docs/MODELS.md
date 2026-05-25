# Modelos

**Última atualização:** 2026-05-25  
**Fonte:** `lib/models/modelConfig.ts`

## Catálogo Atual

### Chat e Reasoning

| ID | Nome | Família | Reasoning | Contexto | Max output | Badge |
|---|---|---|---|---|---|---|
| `gpt-5.1-chat-latest` | GPT-5.1 Instant | `gpt-5` | Não | 128K | 16K | Padrao |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Sim | 1.05M | 128K | Frontier |
| `gpt-5.4-mini` | GPT-5.4 mini | `gpt-5` | Sim | 128K | 16K | Eficiente |
| `gpt-5.4-nano` | GPT-5.4 Nano | `gpt-5` | Sim | 128K | 16K | Economico |
| `gpt-5.1` | GPT-5.1 | `gpt-5` | Sim | 400K | 128K | Codex |
| `gpt-4.1` | GPT-4.1 | `gpt-4.1` | Não | 1.05M | 32K | Confiavel |
| `o3` | o3 | `o-series` | Sim | 200K | 100K | Raciocinio |

### Imagem

| ID | Nome | Família | Uso |
|---|---|---|---|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | Tool real de geração de imagem em `/api/chat` |
| `dall-e-3` | DALL-E 3 | `dall-e` | Modelo legado/listado no catálogo |

## Defaults

- Modelo padrão do chat: `gpt-5.1-chat-latest`.
- Modelo de imagem usado pela tool: `gpt-image-2`.
- Quiz força `gpt-5.4` com reasoning `high`.
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
