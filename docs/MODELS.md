# Model Configuration

**Last updated:** 2026-05-24  
**Source:** `lib/models/modelConfig.ts`

## Available Models (7 chat/reasoning + 2 image)

### Chat and Reasoning

| ID | Name | Family | Reasoning | Context | Max Output | Pricing (in/out per 1M) | Badge |
|----|------|--------|-----------|---------|------------|---------------------------|-------|
| `gpt-5.1-chat-latest` | GPT-5.1 Instant | `gpt-5` | No | 128K | 16K | $1.75 / $4 | Padrao |
| `gpt-5.4` | GPT-5.4 | `gpt-5` | Yes | 1.05M | 128K | $3.75 / $22.5 | Frontier |
| `gpt-5.4-mini` | GPT-5.4 mini | `gpt-5` | Yes | 128K | 16K | $1.1 / $4.4 | Eficiente |
| `gpt-5.4-nano` | GPT-5.4 Nano | `gpt-5` | Yes | 128K | 16K | $0.04 / $0.16 | Economico |
| `gpt-5.1` | GPT-5.1 | `gpt-5` | Yes | 400K | 128K | $1.75 / $14 | Codex |
| `gpt-4.1` | GPT-4.1 | `gpt-4.1` | No | 1.05M | 32K | $2.5 / $10 | Confiavel |
| `o3` | o3 | `o-series` | Yes | 200K | 100K | $10 / $40 | Raciocinio |

### Image Generation

| ID | Name | Family | Pricing |
|----|------|--------|---------|
| `gpt-image-2` | GPT Image 2 | `gpt-image` | $0.04/input |
| `dall-e-3` | DALL-E 3 | `dall-e` | $0.04/input |

## Runtime Defaults

- Default selected model: `gpt-5.1-chat-latest` (`stores/settingsStore.ts`).
- Default `reasoningEffort`:
  - `gpt-5.4-mini`: `none`
  - other reasoning models: `medium`
  - non-reasoning models: `none`
- Default `reasoningSummary`: `off` when effort is `none`, otherwise `concise`.

## Reasoning vs Temperature Rules

The API only sends `temperature` and `top_p` when `modelSupportsTemperature(model)` is true.

Current catalog note:
- all active chat/reasoning models currently have `supportsTemperature: false`.

## Verbosity and Code Interpreter

- `verbosity` is only sent when `modelSupportsVerbosity(model)` is true.
- `codeInterpreterEnabled` only adds the tool when `modelSupportsCodeInterpreter(model)` is true.

## Chat API Guardrails

`app/api/chat/route.ts` enforces:

- Allowed models are derived from `MODELS` and restricted to chat/reasoning capabilities.
- `maxOutputTokens` is clamped to each model's `maxOutput`.
- `responseMode = "quiz"` forces:
  - model: `gpt-5.4`
  - reasoning effort: `high`
  - strict JSON schema output.

## Helper Functions

`lib/models/modelConfig.ts` exports:

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

## Adding/Changing Models

1. Update `MODELS` in `lib/models/modelConfig.ts`.
2. If introducing a new family, update `ModelFamily` in `types/index.ts`.
3. Validate with:

```bash
npx tsc --noEmit
npm run build
```
