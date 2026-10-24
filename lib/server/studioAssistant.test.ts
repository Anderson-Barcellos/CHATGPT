import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildStudioResponseParams,
  parseStudioAssistantRequest,
} from "@/lib/server/studioAssistant";

const validRequest = {
  prompt: "Revise esta função.",
  model: "gpt-6-luna",
  file: {
    path: "src/calculadora.ts",
    language: "typescript",
    content: "export const soma = (a: number, b: number) => a + b;",
  },
  history: [{ role: "assistant", content: "Pode enviar o arquivo." }],
};

describe("Studio assistant request", () => {
  it("builds a read-only Responses request with web search and the active file", () => {
    const parsed = parseStudioAssistantRequest(validRequest);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const params = buildStudioResponseParams(parsed.value);
    expect(params.model).toBe("gpt-6-luna");
    expect(params.store).toBe(false);
    expect(params.tools).toEqual([
      {
        type: "web_search_preview",
        search_context_size: "medium",
        user_location: { type: "approximate", country: "BR" },
      },
    ]);
    expect(params.reasoning).toEqual({ effort: "medium" });
    expect(params.text).toBeUndefined();
    expect(JSON.stringify(params.input)).toContain("src/calculadora.ts");
    expect(JSON.stringify(params.input)).toContain("Revise esta função.");
    expect(params.instructions).toContain("somente-leitura");
    expect(params.instructions).toContain("Use pesquisa web");
    expect(params.instructions).toContain("Não diga que editou");
  });

  it("falls back to the Studio default for an unknown model", () => {
    const parsed = parseStudioAssistantRequest({
      ...validRequest,
      model: "modelo-inexistente",
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.model).toBe("gpt-6-luna");
    }
  });

  it("resolve o mini e o Grok persistidos para Luna, com a busca web da OpenAI", () => {
    for (const legacy of ["gpt-5.4-mini", "grok-4.7"]) {
      const parsed = parseStudioAssistantRequest({ ...validRequest, model: legacy });

      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.value.model).toBe("gpt-6-luna");

      const params = buildStudioResponseParams(parsed.value);
      expect(params).toMatchObject({
        model: "gpt-6-luna",
        store: false,
        reasoning: { effort: "medium" },
        tools: [expect.objectContaining({ type: "web_search_preview" })],
      });
      expect(params.instructions).toContain("somente-leitura");
    }
  });

  it("aceita o modo célula com intent, código e erro", () => {
    const parsed = parseStudioAssistantRequest({
      ...validRequest,
      file: { path: "notebooks/analise.ipynb", language: "python", content: "import pandas as pd" },
      cell: {
        intent: "fix",
        source: "df = pd.read_csv('x.csv')\ndf.head(",
        error: "SyntaxError: unexpected EOF while parsing",
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.cell).toEqual({
      intent: "fix",
      source: "df = pd.read_csv('x.csv')\ndf.head(",
      error: "SyntaxError: unexpected EOF while parsing",
    });

    const params = buildStudioResponseParams(parsed.value);
    const serialized = JSON.stringify(params.input);
    expect(serialized).toContain("df.head(");
    expect(serialized).toContain("SyntaxError");
    expect(serialized).toContain("import pandas as pd");
    expect(params.instructions).toContain("bloco de código Python");
    expect(params.tools).toEqual([]);
    expect(params.reasoning).toEqual({ effort: "medium" });
    expect(params.text).toBeUndefined();
  });

  it("ignora cell malformada sem derrubar a requisição", () => {
    const parsed = parseStudioAssistantRequest({
      ...validRequest,
      cell: { intent: "outra-coisa", source: 42 },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.cell).toBeUndefined();
  });

  it("rejects oversized active-file context", () => {
    const parsed = parseStudioAssistantRequest({
      ...validRequest,
      file: { ...validRequest.file, content: "x".repeat(160_001) },
    });

    expect(parsed).toMatchObject({
      ok: false,
      code: "studio_file_invalid",
    });
  });
});
