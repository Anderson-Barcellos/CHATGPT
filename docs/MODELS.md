# Model Configuration

**Last updated:** 2026-01-30  
**Source:** `lib/models/modelConfig.ts`

## Available Models (8 chat + 1 image)

### GPT-5.1 Series (newest)

| ID | Name | Reasoning | Temperature | Context | Pricing (in/out per 1M) | Badge |
|----|------|-----------|-------------|---------|--------------------------|-------|
| `gpt-5.1-chat-latest` | GPT-5.1 Instant | No | Yes | 256K | $5 / $15 | Rapido |
| `gpt-5.1` | GPT-5.1 Thinking | Yes | No | 256K | $5 / $15 | Mais Novo |
| `gpt-5.1-pro` | GPT-5.1 Pro | Yes | No | 256K | $15 / $60 | Premium |

### GPT-4 Series

| ID | Name | Reasoning | Temperature | Context | Pricing (in/out per 1M) | Badge |
|----|------|-----------|-------------|---------|--------------------------|-------|
| `gpt-4o` | GPT-4o | No | Yes | 128K | $2.5 / $10 | — |
| `gpt-4.1` | GPT-4.1 | No | Yes | 128K | $2.5 / $10 | Confiavel |

### O-Series (reasoning specialists)

| ID | Name | Reasoning | Temperature | Context | Pricing (in/out per 1M) | Badge |
|----|------|-----------|-------------|---------|--------------------------|-------|
| `o3` | o3 | Yes | No | 200K | $10 / $40 | Raciocinio |
| `o4-mini` | o4-mini | Yes | No | 200K | $1.1 / $4.4 | Novo |

### Image Generation

| ID | Name | Context | Pricing |
|----|------|---------|---------|
| `dall-e-3` | DALL-E 3 | 4K | $0.04/image |

## Reasoning vs Temperature Logic

Reasoning models and temperature are **mutually exclusive** in the OpenAI API. The system enforces this at three levels:

### 1. Model Config Flags

Each model declares:
- `capabilities: [...]` — includes `"reasoning"` for thinking models
- `supportsTemperature: boolean` — `false` for all reasoning models

### 2. Frontend (InputArea.tsx)

```
Model selected
  → isReasoningModel(model) ?
    → Show reasoning effort selector (none/low/medium/high/xhigh)
    → Hide temperature/topP from API request body
  : → Hide reasoning effort selector
    → Include temperature/topP in request body
```

The `handleModelChange` callback resets reasoning/temperature when switching model types.

### 3. API Routes (chat/route.ts, canvas/route.ts)

```typescript
const reasoningConfig = isReasoningModel(model) ? reasoning : undefined;
const useTemp = modelSupportsTemperature(model);

await openai.responses.create({
  model,
  ...(useTemp && { temperature, top_p: topP }),
  reasoning: reasoningConfig,
});
```

This prevents `400 Unsupported parameter` errors from the OpenAI API.

## Reasoning Effort Options

| Value | Label | Description |
|-------|-------|-------------|
| `none` | Sem | Direct response, no chain-of-thought |
| `low` | Baixo | Light reasoning |
| `medium` | Medio | Balanced (default) |
| `high` | Alto | Deep reasoning |
| `xhigh` | Maximo | Exhaustive analysis |

## Reasoning Summary Options

| Value | Description |
|-------|-------------|
| `off` | No summary returned |
| `auto` | Model decides (default) |
| `concise` | Brief summary |
| `detailed` | Full reasoning breakdown |

## Helper Functions

| Function | Purpose |
|----------|---------|
| `isReasoningModel(id)` | Check if model has `"reasoning"` capability |
| `modelSupportsTemperature(id)` | Check `supportsTemperature` flag |
| `getChatModels()` | Filter out DALL-E, return chat/reasoning models |
| `getModelsByCapability(cap)` | Filter by any capability string |
| `getModelsByFamily(family)` | Filter by family (gpt-5, o-series, etc.) |
| `calculateCost(in, out, id, cached?)` | Compute USD cost |
| `estimateCost(prompt, outputTokens, id)` | Estimate from raw text |
| `fitsInContextWindow(in, out, id)` | Check token limits |
| `getBestModelForTask(task, budget?)` | Auto-recommend model |
| `formatCost(cost)` | Pretty-print USD |
| `formatTokenCount(tokens)` | Pretty-print token count (e.g. "12.5K") |

## Adding a New Model

1. Add entry to `MODELS` in `lib/models/modelConfig.ts`
2. If new family: add to `ModelFamily` union in `types/index.ts`
3. If new family: add keys to all `Record<ModelFamily, ...>` in `components/settings/ModelSelector.tsx` (grouped, familyLabels, familyIcons)
4. Build and verify: `npm run build`
