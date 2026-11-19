import { MODELS } from "@/lib/models/modelConfig";
import { assertRevision, ChatCatalogError, readChatModelCatalog } from "./chatModelCatalog";
import { createOpenAIClient } from "./chatRequest";

export async function suggestChatBadges(revision: number, signal: AbortSignal) {
  const catalog = await readChatModelCatalog();
  assertRevision(catalog, revision);
  const models = catalog.rows.filter(row => row.visible).map(({ model }) => ({
    id: model.id, provider: model.provider, capabilities: model.capabilities,
    efforts: model.supportedReasoningEfforts ?? [], pricing: MODELS[model.id]?.pricing ?? null,
  }));
  const input = models.map(model => {
    const candidates = ["Texto"];
    if (MODELS[model.id]?.badge === "Equilibrado") candidates.push("Equilibrado");
    if (model.efforts.includes("max")) candidates.push("Análise profunda");
    if (model.capabilities.includes("vision")) candidates.push("Multimodal");
    if (model.efforts.length) candidates.push("Raciocínio");
    if (model.capabilities.includes("function-calling")) candidates.push("Ferramentas");
    const price = model.pricing;
    if (price && models.some(other => other.pricing && price.input < other.pricing.input && price.output < other.pricing.output)
      && models.every(other => !other.pricing || (price.input <= other.pricing.input && price.output <= other.pricing.output))) {
      candidates.push("Econômico");
    }
    return { ...model, candidates };
  });
  const client = createOpenAIClient();
  if (!client) throw new ChatCatalogError(503, "A credencial OpenAI está indisponível.");
  try {
    const response = await client.responses.create({
      model: "gpt-6-luna", reasoning: { effort: "low" }, store: false,
      instructions: "Compare os modelos visíveis. Para cada ID, escolha entre seus candidates o termo que melhor distingue seu uso, ou uma string vazia. Use apenas os fatos fornecidos. Preços são por milhão de tokens.",
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "catalog_badges", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["suggestions"], properties: {
          suggestions: { type: "array", items: { type: "object", additionalProperties: false,
            required: ["id", "badge"], properties: { id: { type: "string" }, badge: { type: "string" } } } },
        },
      } } },
    }, { signal, timeout: 45000, maxRetries: 0 });
    const { suggestions } = JSON.parse(response.output_text);
    if (!Array.isArray(suggestions)) throw new Error("format");
    const byId = new Map(input.map(item => [item.id, item]));
    const seen = new Set<string>();
    const validated: { id: string; badge: string }[] = [];
    for (const item of suggestions) {
      const model = byId.get(item?.id);
      if (!model || seen.has(model.id) || typeof item.badge !== "string") throw new Error("format");
      seen.add(model.id);
      if (model.candidates.includes(item.badge)) validated.push({ id: model.id, badge: item.badge });
    }
    assertRevision(await readChatModelCatalog(), revision);
    return { revision, suggestions: validated };
  } catch (error) {
    if (error instanceof ChatCatalogError) throw error;
    throw new ChatCatalogError(502, "Não consegui gerar sugestões de rótulos. Tente novamente.");
  }
}
